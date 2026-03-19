// src/app/api/lesson-plans/copy/route.ts
// ✅ 할인 정보(discount_amount, discount_memo) 승계 추가
// ✅ fix: isBlocked KST 기준 날짜/요일, 분 단위 시간 비교로 수정
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

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

  const { data: toMonthRecord } = await supabaseAdmin
    .from('months')
    .select('year, month')
    .eq('id', to_month_id)
    .single()

  if (!toMonthRecord) {
    return NextResponse.json({ error: '대상 월 정보 없음' }, { status: 404 })
  }

  const { year: toYear, month: toMonth } = toMonthRecord

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

  const { data: existingPlans } = await supabaseAdmin
    .from('lesson_plans')
    .select('member_id, coach_id')
    .eq('month_id', to_month_id)

  const existingPlanSet = new Set(
    (existingPlans ?? []).map((p: any) => `${p.member_id}_${p.coach_id}`)
  )

  const { data: existingPlansFull } = await supabaseAdmin
    .from('lesson_plans')
    .select('id, member_id, coach_id')
    .eq('month_id', to_month_id)

  const existingPlanMap = new Map(
    (existingPlansFull ?? []).map((p: any) => [`${p.member_id}_${p.coach_id}`, p.id])
  )

  const { data: coachBlocks } = await supabaseAdmin.from('coach_blocks').select('*')
  const blocks = coachBlocks ?? []

  // ✅ fix: KST 기준 날짜/요일, 분 단위 시간 비교
  const isBlocked = (coachId: string, dateObj: Date, timeStr: string, duration: number): boolean => {
    const kst       = new Date(dateObj.getTime() + 9 * 60 * 60 * 1000)
    const dateStr   = kst.toISOString().split('T')[0]
    const dayOfWeek = kst.getUTCDay()
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
      const bs = b.block_start ? Number(b.block_start.split(':')[0])*60+Number(b.block_start.split(':')[1]) : 0
      const be = b.block_end   ? Number(b.block_end.split(':')[0])*60+Number(b.block_end.split(':')[1])   : 24*60
      return reqS < be && reqE > bs
    })
  }

  const daysInToMonth = new Date(toYear, toMonth, 0).getDate()
  const toMonthDates: { date: Date; dayOfWeek: number }[] = []
  for (let d = 1; d <= daysInToMonth; d++) {
    const date = new Date(toYear, toMonth - 1, d)
    toMonthDates.push({ date, dayOfWeek: date.getDay() })
  }

  let copiedPlans   = 0
  let skippedPlans  = 0
  let createdSlots  = 0
  let conflictSlots = 0
  let skippedSlots  = 0

  for (const plan of sourcePlans) {
    const planKey = `${plan.member_id}_${plan.coach_id}`
    let newPlanId: string

    const memberDiscount = memberDiscountMap.get(plan.member_id) ?? { discount_amount: 0, discount_memo: null }

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
          program_id:        plan.program_id ?? null,
          next_month_synced: false,
          discount_amount:   memberDiscount.discount_amount,
          discount_memo:     memberDiscount.discount_memo,
          family_member_id:  plan.family_member_id ?? null,
        })
        .select('id')
        .single()

      if (planErr || !newPlan) continue
      newPlanId = newPlan.id
      copiedPlans++
    }

    const slots = (plan.slots ?? []).filter((s: any) =>
      !s.is_makeup && !['cancelled', 'draft'].includes(s.status)
    )
    if (slots.length === 0) continue

    const patternCount: Record<string, { count: number; duration: number }> = {}
    for (const slot of slots) {
      const utc = new Date(slot.scheduled_at)
      const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000)
      const dow = kst.getUTCDay()
      const hh  = String(kst.getUTCHours()).padStart(2, '0')
      const mm  = String(kst.getUTCMinutes()).padStart(2, '0')
      const key = `${dow}_${hh}:${mm}`
      if (!patternCount[key]) patternCount[key] = { count: 0, duration: slot.duration_minutes }
      patternCount[key].count++
    }

    const threshold = Math.max(1, Math.floor(slots.length / 6))
    const patterns  = Object.entries(patternCount)
      .filter(([, v]) => v.count >= threshold)
      .map(([key, v]) => {
        const [day, time] = key.split('_')
        return { dayOfWeek: Number(day), time, duration: v.duration }
      })

    if (patterns.length === 0) continue

    const { data: existingSlots } = await supabaseAdmin
      .from('lesson_slots')
      .select('scheduled_at')
      .eq('lesson_plan_id', newPlanId)
      .in('status', ['draft', 'scheduled'])

    const existingSlotTimes = new Set(
      (existingSlots ?? []).map((s: any) => s.scheduled_at.slice(0, 16))
    )

    const draftSlotsToInsert: any[] = []

    for (const pattern of patterns) {
      const matchingDates = toMonthDates.filter(d => d.dayOfWeek === pattern.dayOfWeek)
      for (const { date } of matchingDates) {
        const [hh, mm] = pattern.time.split(':').map(Number)
        const slotDate = new Date(toYear, toMonth - 1, date.getDate(), hh, mm, 0)
        const kstStr   = `${toYear}-${String(toMonth).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00+09:00`
        const slotKey  = kstStr.slice(0, 16)

        if (existingSlotTimes.has(slotKey)) {
          skippedSlots++
          continue
        }

        // ✅ fix: duration 전달
        const blocked = isBlocked(plan.coach_id, slotDate, pattern.time, pattern.duration)
        if (blocked) conflictSlots++

        draftSlotsToInsert.push({
          lesson_plan_id:   newPlanId,
          scheduled_at:     kstStr,
          duration_minutes: pattern.duration,
          status:           'draft',
          slot_type:        'lesson',
          is_makeup:        false,
          has_conflict:     blocked,
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
  if (conflictSlots > 0) parts.push(`⚠️ 휴무 충돌 ${conflictSlots}건`)
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