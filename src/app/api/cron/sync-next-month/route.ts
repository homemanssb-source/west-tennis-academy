// ============================================================
// 저장 위치: app/api/cron/sync-next-month/route.ts
// 기존 파일 전체 교체
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ── 유틸: ISO KST 문자열 파싱 (UTC 변환 없이 문자열 직접 읽기) ──────────
function parseKST(iso: string): { year: number; month: number; date: number; hh: number; mm: number; day: number } {
  // "2025-03-04T10:00:00+09:00" → 직접 파싱
  const [datePart, timePart] = iso.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [hStr] = timePart.split('+')
  const [hh, mm] = hStr.split(':').map(Number)
  const jsDate = new Date(y, mo - 1, d)   // 로컬 → 요일 계산용
  return { year: y, month: mo, date: d, hh, mm, day: jsDate.getDay() }
}

function makeISOKST(year: number, month: number, date: number, hh: number, mm: number): string {
  return `${year}-${String(month).padStart(2,'0')}-${String(date).padStart(2,'0')}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00+09:00`
}

// 지정 월의 특정 요일(0=일..6=토) 날짜 목록
function getDatesForDay(year: number, month: number, dayOfWeek: number): number[] {
  const dates: number[] = []
  for (let d = 1; d <= 31; d++) {
    const jsDate = new Date(year, month - 1, d)
    if (jsDate.getMonth() !== month - 1) break
    if (jsDate.getDay() === dayOfWeek) dates.push(d)
  }
  return dates
}

// ── 패턴 추출: 보강·취소 제외 정규 수업 요일+시간 추출 ──────────────────
function extractPattern(slots: any[]): Array<{ day: number; time: string }> | null {
  const regular = slots.filter((s: any) => !s.is_makeup && s.status !== 'cancelled')
  if (regular.length < 2) return null

  const counts: Record<string, number> = {}
  for (const s of regular) {
    const { day, hh, mm } = parseKST(s.scheduled_at)
    const key = `${day}_${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
    counts[key] = (counts[key] ?? 0) + 1
  }

  // 전체 슬롯 수 기준 threshold (단발 추가수업 제외)
  const threshold = Math.max(2, Math.floor(regular.length / 5))
  const result = Object.entries(counts)
    .filter(([, cnt]) => cnt >= threshold)
    .map(([key]) => {
      const [dayStr, time] = key.split('_')
      return { day: parseInt(dayStr), time }
    })

  return result.length > 0 ? result : null
}

// ── 휴무 충돌 체크 ──────────────────────────────────────────────────────
function hasConflict(
  blocks: any[],
  coachId: string,
  dateStr: string,   // "YYYY-MM-DD"
  timeStr: string    // "HH:MM"
): boolean {
  return blocks
    .filter((b: any) => b.coach_id === coachId)
    .some((b: any) => {
      if (b.block_date !== dateStr) return false
      if (!b.block_start && !b.block_end) return true          // 종일 휴무
      if (b.block_start && b.block_end)
        return timeStr >= b.block_start && timeStr < b.block_end
      return false
    })
}

// ────────────────────────────────────────────────────────────────────────
export async function GET() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  if (kst.getDate() !== 15) return NextResponse.json({ ok: true, skipped: 'not 15th' })

  const thisYear  = kst.getFullYear()
  const thisMonth = kst.getMonth() + 1
  const nextMonth = thisMonth === 12 ? 1  : thisMonth + 1
  const nextYear  = thisMonth === 12 ? thisYear + 1 : thisYear

  // ── 1) 다음달 month 레코드 확인 / 자동 생성 ──────────────────────────
  let nextMonthRec = (await supabaseAdmin
    .from('months').select('id').eq('year', nextYear).eq('month', nextMonth).maybeSingle()).data

  if (!nextMonthRec) {
    const lastDay   = new Date(nextYear, nextMonth, 0).getDate()
    const { data: created } = await supabaseAdmin
      .from('months')
      .insert({
        year: nextYear, month: nextMonth,
        start_date: `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`,
        end_date:   `${nextYear}-${String(nextMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`,
      })
      .select('id').single()
    nextMonthRec = created
  }

  if (!nextMonthRec) return NextResponse.json({ error: '다음달 month 생성 실패' }, { status: 500 })

  // ── 2) 이번달 미동기화 플랜 조회 ─────────────────────────────────────
  const currMonthRec = (await supabaseAdmin
    .from('months').select('id').eq('year', thisYear).eq('month', thisMonth).maybeSingle()).data
  if (!currMonthRec) return NextResponse.json({ ok: true, skipped: 'no current month' })

  const { data: plans } = await supabaseAdmin
    .from('lesson_plans').select('*')
    .eq('month_id', currMonthRec.id)
    .eq('next_month_synced', false)

  if (!plans || plans.length === 0) return NextResponse.json({ ok: true, synced: 0 })

  // ── 3) 다음달 이미 존재하는 (member, coach) 세트 ─────────────────────
  const { data: existingNextPlans } = await supabaseAdmin
    .from('lesson_plans').select('member_id, coach_id')
    .eq('month_id', nextMonthRec.id)

  const existsSet = new Set(
    (existingNextPlans ?? []).map((p: any) => `${p.member_id}__${p.coach_id}`)
  )

  // ── 4) 코치 휴무 전체 (다음달 해당 범위만) ───────────────────────────
  const nextStart = `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`
  const nextEnd   = `${nextYear}-${String(nextMonth).padStart(2,'0')}-${String(new Date(nextYear, nextMonth, 0).getDate()).padStart(2,'0')}`

  const { data: blocks } = await supabaseAdmin
    .from('coach_blocks')
    .select('*')
    .gte('block_date', nextStart)
    .lte('block_date', nextEnd)

  const coachBlocks = blocks ?? []

  // ── 5) 플랜별 처리 ────────────────────────────────────────────────────
  const stats = { plans_created: 0, plans_skipped: 0, drafts_ok: 0, drafts_conflict: 0 }
  const planIdsToSync: string[] = []
  const memberNotifySet = new Set<string>()

  for (const plan of plans) {
    const key = `${plan.member_id}__${plan.coach_id}`

    if (existsSet.has(key)) {
      // 이미 다음달 플랜 있음 → synced 표시만
      stats.plans_skipped++
      planIdsToSync.push(plan.id)
      continue
    }

    // 5-1) 플랜 복사 (슬롯 없이 껍데기만)
    const { data: newPlan, error: planErr } = await supabaseAdmin
      .from('lesson_plans')
      .insert({
        member_id:       plan.member_id,
        coach_id:        plan.coach_id,
        month_id:        nextMonthRec.id,
        lesson_type:     plan.lesson_type,
        unit_minutes:    plan.unit_minutes,
        total_count:     0,             // 확정 시 실제 슬롯 수로 업데이트
        completed_count: 0,
        payment_status:  'unpaid',
        amount:          plan.amount,
        program_id:      plan.program_id ?? null,
        next_month_synced: false,
      })
      .select('id').single()

    if (planErr || !newPlan) {
      console.error('[sync-next-month] 플랜 생성 실패:', planErr?.message)
      continue
    }

    existsSet.add(key)
    stats.plans_created++
    planIdsToSync.push(plan.id)

    // 5-2) 이번달 슬롯 패턴 추출
    const { data: thisSlots } = await supabaseAdmin
      .from('lesson_slots').select('scheduled_at, status, is_makeup')
      .eq('lesson_plan_id', plan.id)

    const pattern = extractPattern(thisSlots ?? [])
    if (!pattern) continue   // 패턴 없으면 플랜만 생성, 슬롯은 운영자가 수동 입력

    // 5-3) draft 슬롯 생성
    const draftSlots: any[] = []

    for (const pat of pattern) {
      const [hh, mm] = pat.time.split(':').map(Number)
      const timeStr  = pat.time   // "HH:MM"
      const dates    = getDatesForDay(nextYear, nextMonth, pat.day)

      for (const d of dates) {
        const dateStr  = `${nextYear}-${String(nextMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`
        const blocked  = hasConflict(coachBlocks, plan.coach_id, dateStr, timeStr)
        const iso      = makeISOKST(nextYear, nextMonth, d, hh, mm)

        draftSlots.push({
          lesson_plan_id:   newPlan.id,
          scheduled_at:     iso,
          duration_minutes: plan.unit_minutes,
          status:           'draft',
          is_makeup:        false,
          slot_type:        'lesson',
          has_conflict:     blocked,
        })

        if (blocked) stats.drafts_conflict++
        else         stats.drafts_ok++
      }
    }

    if (draftSlots.length > 0) {
      const { error: slotErr } = await supabaseAdmin.from('lesson_slots').insert(draftSlots)
      if (slotErr) console.error('[sync-next-month] draft 슬롯 삽입 오류:', slotErr.message)
      else memberNotifySet.add(plan.member_id)
    }
  }

  // ── 6) synced 표시 ────────────────────────────────────────────────────
  if (planIdsToSync.length > 0) {
    await supabaseAdmin
      .from('lesson_plans')
      .update({ next_month_synced: true })
      .in('id', planIdsToSync)
  }

  // ── 7) 알림 ──────────────────────────────────────────────────────────
  const notifInserts: any[] = []

  // 회원별 (초안 생성됨)
  memberNotifySet.forEach(memberId => {
    notifInserts.push({
      profile_id: memberId,
      title: `📅 ${nextYear}년 ${nextMonth}월 레슨 일정 초안 생성`,
      body:  `다음달 레슨 초안이 준비됐습니다. 운영자 확인 후 최종 확정됩니다.`,
      type:  'info',
      link:  '/member/schedule',
    })
  })

  // 운영자 (확정 요청)
  const totalDrafts = stats.drafts_ok + stats.drafts_conflict
  if (totalDrafts > 0) {
    const owners = await supabaseAdmin.from('profiles').select('id').eq('role', 'owner')
    for (const o of owners.data ?? []) {
      notifInserts.push({
        profile_id: o.id,
        title: `🗓 ${nextYear}년 ${nextMonth}월 수업 초안 ${totalDrafts}건 생성`,
        body:  `충돌 ${stats.drafts_conflict}건 포함. /owner/schedule-draft 에서 확인 후 확정해 주세요.`,
        type:  stats.drafts_conflict > 0 ? 'warning' : 'success',
        link:  '/owner/schedule-draft',
      })
    }
  }

  if (notifInserts.length > 0)
    await supabaseAdmin.from('notifications').insert(notifInserts)

  return NextResponse.json({
    ok: true,
    year: nextYear, month: nextMonth,
    plans_created: stats.plans_created,
    plans_skipped: stats.plans_skipped,
    drafts_ok:       stats.drafts_ok,
    drafts_conflict: stats.drafts_conflict,
  })
}