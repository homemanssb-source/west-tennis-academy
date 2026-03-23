// src/app/api/lesson-plans/copy/route.ts
// ✅ 전면 재작성
// ✅ fix: existingPlanSet/Map 키에 family_member_id 포함
// ✅ fix: toMonthDates 요일 KST 기준 (getDayOfWeekKST)
// ✅ fix: threshold → sync-next-month 방식 (요일별 50%)
// ✅ fix: isBlocked KST 기준 날짜/요일 + 분단위 시간 비교
// ✅ fix: family_member_id insert 승계
// ✅ new: 대상월 scheduled 슬롯과 시간 겹치면 has_conflict:true
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// ── KST 유틸 (sync-next-month와 동일) ────────────────────────────────────
function makeKSTDatetime(year: number, month: number, day: number, hh: number, mm: number): string {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00+09:00`
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getDayOfWeekKST(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay()
}

function parseKSTSlot(scheduledAt: string): { dow: number; hh: number; mm: number } {
  const d   = new Date(scheduledAt)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return { dow: kst.getUTCDay(), hh: kst.getUTCHours(), mm: kst.getUTCMinutes() }
}

// ─────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { from_month_id, to_month_id, coach_id } = await req.json()
  if (!from_month_id || !to_month_id) {
    return NextResponse.json({ error: '원본/대상 월 필요' }, { status: 400 })
  }
  if (from_month_id === to_month_id) {
    return NextResponse.json({ error: '원본과 대상 월이 같습니다' }, { status: 400 })
  }

  // ── 대상 월 정보 ─────────────────────────────────────────────────────
  const { data: toMonthRecord } = await supabaseAdmin
    .from('months')
    .select('year, month')
    .eq('id', to_month_id)
    .single()

  if (!toMonthRecord) {
    return NextResponse.json({ error: '대상 월 정보 없음' }, { status: 404 })
  }
  const { year: toYear, month: toMonth } = toMonthRecord

  // ── 원본 월 플랜 조회 (슬롯 포함) ────────────────────────────────────
  let query = supabaseAdmin
    .from('lesson_plans')
    .select(`
      *,
      slots:lesson_slots (
        scheduled_at, duration_minutes, status, is_makeup
      )
    `)
    .eq('month_id', from_month_id)

  if (coach_id) query = query.eq('coach_id', coach_id)

  const { data: sourcePlans, error: plansErr } = await query

  if (!sourcePlans || sourcePlans.length === 0) {
    return NextResponse.json({ error: '복사할 플랜이 없습니다', debug: plansErr?.message }, { status: 404 })
  }

  // ── 회원별 최신 할인 정보 ────────────────────────────────────────────
  const memberIds = [...new Set(sourcePlans.map((p: any) => p.member_id))]
  const { data: memberProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, discount_amount, discount_memo')
    .in('id', memberIds)

  const memberDiscountMap = new Map(
    (memberProfiles ?? []).map((m: any) => [m.id, {
      discount_amount: m.discount_amount ?? 0,
      discount_memo:   m.discount_memo   ?? null,
    }])
  )

  // ── 대상 월 이미 있는 플랜 (family_member_id 포함 키) ────────────────
  const { data: existingPlansFull } = await supabaseAdmin
    .from('lesson_plans')
    .select('id, member_id, coach_id, family_member_id')
    .eq('month_id', to_month_id)

  const existingPlanSet = new Set(
    (existingPlansFull ?? []).map((p: any) =>
      `${p.member_id}_${p.coach_id}_${p.family_member_id ?? ''}`
    )
  )
  const existingPlanMap = new Map(
    (existingPlansFull ?? []).map((p: any) => [
      `${p.member_id}_${p.coach_id}_${p.family_member_id ?? ''}`,
      p.id,
    ])
  )

  // ── 코치 휴무 전체 조회 ──────────────────────────────────────────────
  const { data: coachBlocks } = await supabaseAdmin.from('coach_blocks').select('*')
  const blocks = coachBlocks ?? []

  // ── isBlocked: KST 날짜/요일 기준 + 분단위 시간 비교 ─────────────────
  const isBlocked = (
    coachId: string,
    year: number, month: number, day: number,
    timeStr: string, duration: number
  ): boolean => {
    const dateStr   = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const dayOfWeek = getDayOfWeekKST(year, month, day)
    const [th, tm]  = timeStr.split(':').map(Number)
    const reqS      = th * 60 + tm
    const reqE      = reqS + duration

    return blocks.some((b: any) => {
      if (b.coach_id !== coachId) return false
      if (b.repeat_weekly) {
        if (b.day_of_week !== dayOfWeek) return false
      } else {
        if (b.block_date !== dateStr) return false
      }
      if (!b.block_start && !b.block_end) return true
      const bs = b.block_start
        ? Number(b.block_start.split(':')[0]) * 60 + Number(b.block_start.split(':')[1])
        : 0
      const be = b.block_end
        ? Number(b.block_end.split(':')[0]) * 60 + Number(b.block_end.split(':')[1])
        : 24 * 60
      return reqS < be && reqE > bs
    })
  }

  // ── 대상 월 날짜 목록 (KST 기준 요일) ────────────────────────────────
  const daysInToMonth = lastDayOfMonth(toYear, toMonth)
  const toMonthDates: { day: number; dayOfWeek: number }[] = []
  for (let d = 1; d <= daysInToMonth; d++) {
    toMonthDates.push({ day: d, dayOfWeek: getDayOfWeekKST(toYear, toMonth, d) })
  }

  // ── 대상 월 이미 scheduled된 슬롯 시간 목록 (중복 경고용) ─────────────
  const { data: scheduledSlots } = await supabaseAdmin
    .from('lesson_slots')
    .select('scheduled_at, lesson_plan:lesson_plan_id(coach_id)')
    .eq('status', 'scheduled')

  // coach_id별 scheduled 시간 Set
  const scheduledByCoach: Record<string, Set<string>> = {}
  for (const s of scheduledSlots ?? []) {
    const cid = (s.lesson_plan as any)?.coach_id
    if (!cid) continue
    if (!scheduledByCoach[cid]) scheduledByCoach[cid] = new Set()
    scheduledByCoach[cid].add((s.scheduled_at as string).slice(0, 16))
  }

  let copiedPlans   = 0
  let skippedPlans  = 0
  let createdSlots  = 0
  let conflictSlots = 0
  let skippedSlots  = 0

  for (const plan of sourcePlans) {
    const planKey = `${plan.member_id}_${plan.coach_id}_${plan.family_member_id ?? ''}`
    let newPlanId: string

    const memberDiscount = memberDiscountMap.get(plan.member_id) ?? {
      discount_amount: 0,
      discount_memo:   null,
    }

    if (existingPlanSet.has(planKey)) {
      skippedPlans++
      newPlanId = existingPlanMap.get(planKey)!
    } else {
      const { data: newPlan, error: planErr } = await supabaseAdmin
        .from('lesson_plans')
        .insert({
          member_id:         plan.member_id,
          coach_id:          plan.coach_id,
          month_id:          to_month_id,
          lesson_type:       plan.lesson_type,
          total_count:       0,
          billing_count:     0,
          completed_count:   0,
          payment_status:    'unpaid',
          amount:            plan.amount,
          unit_minutes:      plan.unit_minutes,
          program_id:        plan.program_id        ?? null,
          next_month_synced: false,
          discount_amount:   memberDiscount.discount_amount,
          discount_memo:     memberDiscount.discount_memo,
          family_member_id:  plan.family_member_id  ?? null, // ✅ 자녀 승계
        })
        .select('id')
        .single()

      if (planErr || !newPlan) continue
      newPlanId = newPlan.id
      copiedPlans++
    }

    // ── 슬롯 패턴 추출 (KST 기준, cancelled/draft 제외) ──────────────
    const slots = (plan.slots ?? []).filter((s: any) =>
      !s.is_makeup && !['cancelled', 'draft'].includes(s.status)
    )
    if (slots.length === 0) continue

    // 요일_HH:MM 별 카운트
    const patternCount: Record<string, { count: number; duration: number }> = {}
    for (const slot of slots) {
      const { dow, hh, mm } = parseKSTSlot(slot.scheduled_at)
      const key = `${dow}_${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
      if (!patternCount[key]) patternCount[key] = { count: 0, duration: slot.duration_minutes }
      patternCount[key].count++
    }

    // ✅ threshold: sync-next-month 방식 — 요일별 최대 횟수의 50%
    // 슬롯 4개 미만이면 1회도 인정
    const patterns = Object.entries(patternCount)
      .filter(([key, v]) => {
        if (slots.length < 4) return v.count >= 1
        const dow = Number(key.split('_')[0])
        // 원본 월에서 해당 요일이 몇 번 나왔는지 계산
        const totalForDow = Object.entries(patternCount)
          .filter(([k]) => Number(k.split('_')[0]) === dow)
          .reduce((sum, [, val]) => sum + val.count, 0)
        return v.count >= Math.ceil(totalForDow * 0.5)
      })
      .map(([key, v]) => {
        const [day, time] = key.split('_')
        const [hh, mm]    = time.split(':').map(Number)
        return { dayOfWeek: Number(day), hh, mm, time, duration: v.duration }
      })

    if (patterns.length === 0) continue

    // ── 이미 있는 슬롯 확인 (중복 삽입 방지) ─────────────────────────
    const { data: existingSlots } = await supabaseAdmin
      .from('lesson_slots')
      .select('scheduled_at')
      .eq('lesson_plan_id', newPlanId)
      .in('status', ['draft', 'scheduled'])

    const existingSlotTimes = new Set(
      (existingSlots ?? []).map((s: any) => (s.scheduled_at as string).slice(0, 16))
    )

    // ── 대상 월 슬롯 생성 ─────────────────────────────────────────────
    const draftSlotsToInsert: any[] = []

    for (const pattern of patterns) {
      const matchingDates = toMonthDates.filter(d => d.dayOfWeek === pattern.dayOfWeek)

      for (const { day } of matchingDates) {
        const kstStr = makeKSTDatetime(toYear, toMonth, day, pattern.hh, pattern.mm)
        const slotKey = kstStr.slice(0, 16)

        if (existingSlotTimes.has(slotKey)) {
          skippedSlots++
          continue
        }

        // ✅ 코치 휴무 충돌 체크 (KST 날짜/요일 직접 계산)
        const blockedByHoliday = isBlocked(
          plan.coach_id, toYear, toMonth, day, pattern.time, pattern.duration
        )

        // ✅ 대상 월 이미 scheduled된 슬롯과 시간 겹침 체크
        const blockedByScheduled =
          scheduledByCoach[plan.coach_id]?.has(slotKey) ?? false

        const hasConflict = blockedByHoliday || blockedByScheduled
        if (hasConflict) conflictSlots++

        draftSlotsToInsert.push({
          lesson_plan_id:   newPlanId,
          scheduled_at:     kstStr,
          duration_minutes: pattern.duration,
          status:           'draft',
          slot_type:        'lesson',
          is_makeup:        false,
          has_conflict:     hasConflict,
        })
      }
    }

    if (draftSlotsToInsert.length > 0) {
      const { error: slotErr } = await supabaseAdmin
        .from('lesson_slots')
        .insert(draftSlotsToInsert)
      if (!slotErr) createdSlots += draftSlotsToInsert.length
    }
  }

  // ── draft_open 자동 설정 ──────────────────────────────────────────────
  if (createdSlots > 0) {
    await supabaseAdmin
      .from('months')
      .update({ draft_open: true })
      .eq('id', to_month_id)
  }

  const parts = []
  if (copiedPlans   > 0) parts.push(`플랜 ${copiedPlans}개 복사`)
  if (skippedPlans  > 0) parts.push(`${skippedPlans}개 기존 플랜 유지`)
  if (createdSlots  > 0) parts.push(`수업 ${createdSlots}개 초안 생성`)
  if (skippedSlots  > 0) parts.push(`${skippedSlots}개 슬롯 이미 존재`)
  if (conflictSlots > 0) parts.push(`⚠️ 충돌 ${conflictSlots}건`)
  if (createdSlots  > 0) parts.push(`✅ 회원 미리보기 오픈됨`)

  return NextResponse.json({
    ok:          true,
    copied:      copiedPlans,
    skipped:     skippedPlans,
    slots:       createdSlots,
    slotSkipped: skippedSlots,
    conflicts:   conflictSlots,
    toMonthId:   to_month_id,
    draftOpen:   createdSlots > 0,
    message:     parts.join(', '),
  })
}