// src/app/api/cron/next-month-sync/route.ts
// 매월 25일 실행 — 다음달 레슨 플랜 + 슬롯 초안 자동 생성
// ✅ [FIX] UTC/KST 날짜 버그 전면 수정
// ✅ [FIX] draft 슬롯 scheduled_at 9시간 오차 수정
// ✅ [FIX] 복수 플랜(개인+그룹) 중복방지 키 수정 (plan.id 기준)
// ✅ [FIX] isBlocked dateStr KST 기준으로 수정
// ✅ [NEW] 아이디어: 회원별 다음달 플랜 summary 알림 개선
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ─────────────────────────────────────────────────────────────
// KST 날짜 유틸 (서버 사이드 — Vercel UTC 환경에서 안전)
// ─────────────────────────────────────────────────────────────
function getKST(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

/** KST Date → 'YYYY-MM-DD' 문자열 (UTC 변환 없이) */
function toKSTDateStr(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const day = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * KST 기준 연/월/일/시/분으로 ISO8601+09:00 문자열 생성
 * (new Date(y,m,d,h,min) → .toISOString() 방식의 UTC 혼동 방지)
 */
function makeKSTDatetime(year: number, month: number, day: number, hh: number, mm: number): string {
  // YYYY-MM-DDTHH:MM:00+09:00
  const y = String(year)
  const mo = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  const h = String(hh).padStart(2, '0')
  const mi = String(mm).padStart(2, '0')
  return `${y}-${mo}-${d}T${h}:${mi}:00+09:00`
}

/** KST 기준 해당 월의 마지막 날 */
function lastDayOfMonth(year: number, month: number): number {
  // month: 1~12
  return new Date(year, month, 0).getDate()
}

/** KST 기준 특정 날의 요일 (0=일~6=토) */
function getDayOfWeekKST(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay()
}

/** ISO datetime 문자열에서 KST 기준 요일/시/분 추출 */
function parseKSTSlot(scheduledAt: string): { dow: number; hh: number; mm: number } {
  // scheduled_at은 '+09:00' suffix 또는 UTC Z 두 형태 모두 처리
  const d = new Date(scheduledAt)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return {
    dow: kst.getUTCDay(),
    hh: kst.getUTCHours(),
    mm: kst.getUTCMinutes(),
  }
}

/** KST 기준 날짜문자열 — isBlocked 에서 사용 */
function scheduledAtToKSTDateStr(scheduledAt: string): string {
  const d = new Date(scheduledAt)
  return toKSTDateStr(d)
}

// ─────────────────────────────────────────────────────────────
// 메인 핸들러
// ─────────────────────────────────────────────────────────────
export async function GET() {
  const kst = getKST()

  if (kst.getUTCDate() !== 25) {
    return NextResponse.json({ ok: true, skipped: 'not 25th' })
  }

  const thisYear  = kst.getUTCFullYear()
  const thisMonth = kst.getUTCMonth() + 1          // 1~12
  const nextMonth = thisMonth === 12 ? 1 : thisMonth + 1
  const nextYear  = thisMonth === 12 ? thisYear + 1 : thisYear

  // ── 다음달 month 레코드 확인 / 자동 생성 ─────────────────────
  const { data: nextMonthRecord } = await supabaseAdmin
    .from('months')
    .select('id')
    .eq('year', nextYear)
    .eq('month', nextMonth)
    .single()

  let nextMonthId = nextMonthRecord?.id
  if (!nextMonthId) {
    // ✅ [FIX] KST 기준 날짜 문자열 생성 (toISOString 사용 안 함)
    const startDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    const lastDay   = lastDayOfMonth(nextYear, nextMonth)
    const endDate   = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data: created, error: createErr } = await supabaseAdmin
      .from('months')
      .insert({ year: nextYear, month: nextMonth, start_date: startDate, end_date: endDate })
      .select('id')
      .single()

    if (createErr) {
      return NextResponse.json(
        { error: '다음달 month 생성 실패: ' + createErr.message },
        { status: 500 }
      )
    }
    nextMonthId = created?.id
  }
  if (!nextMonthId) {
    return NextResponse.json({ error: '다음달 month 없음' }, { status: 500 })
  }

  // ── 이번달 month 조회 ─────────────────────────────────────────
  const { data: currentMonthRecord } = await supabaseAdmin
    .from('months')
    .select('id')
    .eq('year', thisYear)
    .eq('month', thisMonth)
    .single()

  if (!currentMonthRecord) {
    return NextResponse.json({ ok: true, skipped: 'no current month' })
  }

  // ── 이번달 레슨플랜 조회 (next_month_synced = false) ──────────
  const { data: plans } = await supabaseAdmin
    .from('lesson_plans')
    .select('*')
    .eq('month_id', currentMonthRecord.id)
    .eq('next_month_synced', false)

  if (!plans || plans.length === 0) {
    return NextResponse.json({ ok: true, synced: 0 })
  }

  // ── 회원별 최신 할인 정보 일괄 조회 ──────────────────────────
  const memberIds = [...new Set(plans.map((p: any) => p.member_id))]
  const { data: memberProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, discount_amount, discount_memo')
    .in('id', memberIds)

  const memberDiscountMap = new Map(
    (memberProfiles ?? []).map((m: any) => [
      m.id,
      { discount_amount: m.discount_amount ?? 0, discount_memo: m.discount_memo ?? null },
    ])
  )

  // ── 다음달에 이미 있는 플랜 확인 (중복 방지) ─────────────────
  // ✅ [FIX] plan.id 기준이 아닌 member_id+coach_id+lesson_type 조합으로 체크
  //    → 복수 플랜(개인+그룹) 모두 각각 처리 가능하도록
  const { data: existingNextPlans } = await supabaseAdmin
    .from('lesson_plans')
    .select('member_id, coach_id, lesson_type')
    .eq('month_id', nextMonthId)

  const existingSet = new Set(
    (existingNextPlans ?? []).map((p: any) => `${p.member_id}_${p.coach_id}_${p.lesson_type}`)
  )

  // ── 코치 휴무 조회 ────────────────────────────────────────────
  const { data: coachBlocks } = await supabaseAdmin.from('coach_blocks').select('*')
  const blocks = coachBlocks ?? []

  // ── 이번달 슬롯 조회 (패턴 추출용) ──────────────────────────
  const planIds = plans.map((p: any) => p.id)
  const { data: thisMonthSlots } = await supabaseAdmin
    .from('lesson_slots')
    .select('lesson_plan_id, scheduled_at, duration_minutes, status, is_makeup')
    .in('lesson_plan_id', planIds)
    .not('status', 'in', '("cancelled","draft")')
    .eq('is_makeup', false)

  const slotsByPlan: Record<string, any[]> = {}
  for (const slot of thisMonthSlots ?? []) {
    if (!slotsByPlan[slot.lesson_plan_id]) slotsByPlan[slot.lesson_plan_id] = []
    slotsByPlan[slot.lesson_plan_id].push(slot)
  }

  // ── 다음달 날짜 목록 (KST 기준) ─────────────────────────────
  const daysInNextMonth = lastDayOfMonth(nextYear, nextMonth)
  const nextMonthDates: { day: number; dayOfWeek: number }[] = []
  for (let d = 1; d <= daysInNextMonth; d++) {
    nextMonthDates.push({ day: d, dayOfWeek: getDayOfWeekKST(nextYear, nextMonth, d) })
  }

  // ── 이번달 요일별 총 횟수 (50% threshold 계산용) ─────────────
  const daysInThisMonth = lastDayOfMonth(thisYear, thisMonth)
  const totalWeekdayCount: Record<number, number> = {}
  for (let d = 1; d <= daysInThisMonth; d++) {
    const dow = getDayOfWeekKST(thisYear, thisMonth, d)
    totalWeekdayCount[dow] = (totalWeekdayCount[dow] ?? 0) + 1
  }

  // ── 휴무 충돌 체크 (KST 기준) ───────────────────────────────
  const isBlocked = (coachId: string, year: number, month: number, day: number, timeStr: string): boolean => {
    // ✅ [FIX] KST 기준 날짜/요일 사용
    const dateStr   = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayOfWeek = getDayOfWeekKST(year, month, day)

    return blocks.some((b: any) => {
      if (b.coach_id !== coachId) return false
      if (b.block_date && b.block_date === dateStr) {
        if (!b.block_start) return true
        return timeStr >= b.block_start && timeStr <= (b.block_end ?? '23:59')
      }
      if (b.repeat_weekly && b.day_of_week === dayOfWeek) {
        if (!b.block_start) return true
        return timeStr >= b.block_start && timeStr <= (b.block_end ?? '23:59')
      }
      return false
    })
  }

  let totalSynced   = 0
  let totalConflict = 0
  const syncedMemberIds: string[] = []

  for (const plan of plans) {
    // ✅ [FIX] 복수 플랜 중복 방지: lesson_type도 키에 포함
    const existKey = `${plan.member_id}_${plan.coach_id}_${plan.lesson_type}`
    if (existingSet.has(existKey)) {
      await supabaseAdmin
        .from('lesson_plans')
        .update({ next_month_synced: true })
        .eq('id', plan.id)
      continue
    }

    const memberDiscount = memberDiscountMap.get(plan.member_id) ?? {
      discount_amount: 0,
      discount_memo: null,
    }

    // ── 슬롯 패턴 추출 (KST 기준) ───────────────────────────────
    const slots = slotsByPlan[plan.id] ?? []
    const patternCount: Record<string, { count: number; duration: number }> = {}

    for (const slot of slots) {
      // ✅ [FIX] KST 파싱 유틸 사용
      const { dow, hh, mm } = parseKSTSlot(slot.scheduled_at)
      const key = `${dow}_${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
      if (!patternCount[key]) patternCount[key] = { count: 0, duration: slot.duration_minutes }
      patternCount[key].count++
    }

    // 패턴 필터: 슬롯 4개 미만이면 1회도 인정, 이상이면 50% threshold
    const patterns = Object.entries(patternCount)
      .filter(([key, v]) => {
        if (slots.length < 4) return v.count >= 1
        const dayOfWeek   = Number(key.split('_')[0])
        const totalForDay = totalWeekdayCount[dayOfWeek] ?? 1
        return v.count >= Math.ceil(totalForDay * 0.5)
      })
      .map(([key, v]) => {
        const [day, time] = key.split('_')
        const [hh, mm]    = time.split(':').map(Number)
        return { dayOfWeek: Number(day), hh, mm, duration: v.duration }
      })

    // 패턴 없으면 플랜 껍데기만 복사
    if (patterns.length === 0) {
      await supabaseAdmin.from('lesson_plans').insert({
        member_id:         plan.member_id,
        coach_id:          plan.coach_id,
        month_id:          nextMonthId,
        lesson_type:       plan.lesson_type,
        total_count:       0,
        billing_count:     0,
        completed_count:   0,
        payment_status:    'unpaid',
        amount:            plan.amount,
        unit_minutes:      plan.unit_minutes,
        program_id:        plan.program_id ?? null,
        next_month_synced: false,
        discount_amount:   memberDiscount.discount_amount,
        discount_memo:     memberDiscount.discount_memo,
      })
      await supabaseAdmin
        .from('lesson_plans')
        .update({ next_month_synced: true })
        .eq('id', plan.id)
      totalSynced++
      syncedMemberIds.push(plan.member_id)
      continue
    }

    // ── 다음달 draft 슬롯 생성 ───────────────────────────────────
    const draftSlotDates: { datetime: string; duration: number; hasConflict: boolean }[] = []

    for (const pattern of patterns) {
      const matchingDays = nextMonthDates.filter(d => d.dayOfWeek === pattern.dayOfWeek)

      for (const { day } of matchingDays) {
        const timeStr = `${String(pattern.hh).padStart(2, '0')}:${String(pattern.mm).padStart(2, '0')}`

        // ✅ [FIX] KST 기준 datetime 문자열 생성 (UTC 중복 +9h 방지)
        const datetime = makeKSTDatetime(nextYear, nextMonth, day, pattern.hh, pattern.mm)

        // ✅ [FIX] isBlocked에 KST 날짜/요일 직접 전달
        const blocked = isBlocked(plan.coach_id, nextYear, nextMonth, day, timeStr)
        if (blocked) totalConflict++

        draftSlotDates.push({ datetime, duration: pattern.duration, hasConflict: blocked })
      }
    }

    // 다음달 플랜 생성
    const { data: newPlan, error: planErr } = await supabaseAdmin
      .from('lesson_plans')
      .insert({
        member_id:         plan.member_id,
        coach_id:          plan.coach_id,
        month_id:          nextMonthId,
        lesson_type:       plan.lesson_type,
        total_count:       0,
        billing_count:     0,
        completed_count:   0,
        payment_status:    'unpaid',
        amount:            plan.amount,
        unit_minutes:      plan.unit_minutes,
        program_id:        plan.program_id ?? null,
        next_month_synced: false,
        discount_amount:   memberDiscount.discount_amount,
        discount_memo:     memberDiscount.discount_memo,
      })
      .select('id')
      .single()

    if (planErr || !newPlan) continue

    // draft 슬롯 일괄 삽입
    if (draftSlotDates.length > 0) {
      const draftSlots = draftSlotDates.map(s => ({
        lesson_plan_id:   newPlan.id,
        scheduled_at:     s.datetime,
        duration_minutes: s.duration,
        status:           'draft',
        slot_type:        'lesson',
        is_makeup:        false,
        has_conflict:     s.hasConflict,
      }))
      await supabaseAdmin.from('lesson_slots').insert(draftSlots)
    }

    // 중복방지 세트에 추가 (같은 run 내 재중복 방지)
    existingSet.add(existKey)

    await supabaseAdmin
      .from('lesson_plans')
      .update({ next_month_synced: true })
      .eq('id', plan.id)

    totalSynced++
    syncedMemberIds.push(plan.member_id)
  }

  // ── 알림 발송 ─────────────────────────────────────────────────
  const uniqueMemberIds = [...new Set(syncedMemberIds)]
  if (uniqueMemberIds.length > 0) {
    const memberNotifs = uniqueMemberIds.map((id: string) => ({
      profile_id: id,
      title: `📅 ${nextYear}년 ${nextMonth}월 수업 초안 생성`,
      body:  `다음달 수업 일정 초안이 생성되었습니다. 운영자 확정 후 스케줄 탭에서 확인하세요.`,
      type:  'info',
      link:  '/member/schedule',
    }))
    await supabaseAdmin.from('notifications').insert(memberNotifs)
  }

  const { data: owners } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role', ['owner', 'admin'])
    .eq('is_active', true)

  if (owners && owners.length > 0) {
    const ownerNotifs = owners.map((o: any) => ({
      profile_id: o.id,
      title: `🗓️ ${nextYear}년 ${nextMonth}월 수업 초안 생성 완료`,
      body:  `${totalSynced}개 플랜 초안 생성${totalConflict > 0 ? ` (⚠️ 충돌 ${totalConflict}건 확인 필요)` : ''}`,
      type:  totalConflict > 0 ? 'warning' : 'success',
      link:  '/owner/schedule-draft',
    }))
    await supabaseAdmin.from('notifications').insert(ownerNotifs)
  }

  return NextResponse.json({
    ok:        true,
    synced:    totalSynced,
    conflicts: totalConflict,
    nextMonth: `${nextYear}년 ${nextMonth}월`,
  })
}