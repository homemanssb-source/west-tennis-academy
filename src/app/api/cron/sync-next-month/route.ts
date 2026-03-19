// src/app/api/cron/next-month-sync/route.ts
// 매월 25일 실행 — 다음달 레슨 플랜 + 슬롯 초안 자동 생성
// ✅ [FIX] CRON_SECRET 인증 추가 (기존 GET()에서 누락)
// ✅ [FIX] UTC/KST 날짜 버그 전면 수정
// ✅ [FIX] draft 슬롯 scheduled_at 9시간 오차 수정
// ✅ [FIX] 복수 플랜(개인+그룹) 중복방지 키 수정
// ✅ [FIX] isBlocked dateStr KST 기준으로 수정
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function getKST(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

function toKSTDateStr(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const day = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function makeKSTDatetime(year: number, month: number, day: number, hh: number, mm: number): string {
  const y = String(year)
  const mo = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  const h = String(hh).padStart(2, '0')
  const mi = String(mm).padStart(2, '0')
  return `${y}-${mo}-${d}T${h}:${mi}:00+09:00`
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getDayOfWeekKST(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay()
}

function parseKSTSlot(scheduledAt: string): { dow: number; hh: number; mm: number } {
  const d = new Date(scheduledAt)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return { dow: kst.getUTCDay(), hh: kst.getUTCHours(), mm: kst.getUTCMinutes() }
}

// ✅ GET(req: NextRequest) — CRON 인증 추가
export async function GET(req: NextRequest) {
  // ✅ CRON 인증 (다른 cron route들과 동일하게)
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const kst = getKST()

  if (kst.getUTCDate() !== 25) {
    return NextResponse.json({ ok: true, skipped: 'not 25th' })
  }

  const thisYear  = kst.getUTCFullYear()
  const thisMonth = kst.getUTCMonth() + 1
  const nextMonth = thisMonth === 12 ? 1 : thisMonth + 1
  const nextYear  = thisMonth === 12 ? thisYear + 1 : thisYear

  const { data: nextMonthRecord } = await supabaseAdmin
    .from('months')
    .select('id')
    .eq('year', nextYear)
    .eq('month', nextMonth)
    .single()

  let nextMonthId = nextMonthRecord?.id
  if (!nextMonthId) {
    const startDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
    const lastDay   = lastDayOfMonth(nextYear, nextMonth)
    const endDate   = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data: created, error: createErr } = await supabaseAdmin
      .from('months')
      .insert({ year: nextYear, month: nextMonth, start_date: startDate, end_date: endDate })
      .select('id')
      .single()

    if (createErr) return NextResponse.json({ error: '다음달 month 생성 실패: ' + createErr.message }, { status: 500 })
    nextMonthId = created?.id
  }
  if (!nextMonthId) return NextResponse.json({ error: '다음달 month 없음' }, { status: 500 })

  const { data: currentMonthRecord } = await supabaseAdmin
    .from('months').select('id').eq('year', thisYear).eq('month', thisMonth).single()

  if (!currentMonthRecord) return NextResponse.json({ ok: true, skipped: 'no current month' })

  const { data: plans } = await supabaseAdmin
    .from('lesson_plans').select('*')
    .eq('month_id', currentMonthRecord.id).eq('next_month_synced', false)

  if (!plans || plans.length === 0) return NextResponse.json({ ok: true, synced: 0 })

  const memberIds = [...new Set(plans.map((p: any) => p.member_id))]
  const { data: memberProfiles } = await supabaseAdmin
    .from('profiles').select('id, discount_amount, discount_memo').in('id', memberIds)

  const memberDiscountMap = new Map(
    (memberProfiles ?? []).map((m: any) => [m.id, { discount_amount: m.discount_amount ?? 0, discount_memo: m.discount_memo ?? null }])
  )

  const { data: existingNextPlans } = await supabaseAdmin
    .from('lesson_plans').select('member_id, coach_id, lesson_type').eq('month_id', nextMonthId)

  const existingSet = new Set(
    (existingNextPlans ?? []).map((p: any) => `${p.member_id}_${p.coach_id}_${p.lesson_type}`)
  )

  const { data: coachBlocks } = await supabaseAdmin.from('coach_blocks').select('*')
  const blocks = coachBlocks ?? []

  const planIds = plans.map((p: any) => p.id)
  const { data: thisMonthSlots } = await supabaseAdmin
    .from('lesson_slots').select('lesson_plan_id, scheduled_at, duration_minutes, status, is_makeup')
    .in('lesson_plan_id', planIds).not('status', 'in', '("cancelled","draft")').eq('is_makeup', false)

  const slotsByPlan: Record<string, any[]> = {}
  for (const slot of thisMonthSlots ?? []) {
    if (!slotsByPlan[slot.lesson_plan_id]) slotsByPlan[slot.lesson_plan_id] = []
    slotsByPlan[slot.lesson_plan_id].push(slot)
  }

  const daysInNextMonth = lastDayOfMonth(nextYear, nextMonth)
  const nextMonthDates: { day: number; dayOfWeek: number }[] = []
  for (let d = 1; d <= daysInNextMonth; d++) {
    nextMonthDates.push({ day: d, dayOfWeek: getDayOfWeekKST(nextYear, nextMonth, d) })
  }

  const daysInThisMonth = lastDayOfMonth(thisYear, thisMonth)
  const totalWeekdayCount: Record<number, number> = {}
  for (let d = 1; d <= daysInThisMonth; d++) {
    const dow = getDayOfWeekKST(thisYear, thisMonth, d)
    totalWeekdayCount[dow] = (totalWeekdayCount[dow] ?? 0) + 1
  }

  const isBlocked = (coachId: string, year: number, month: number, day: number, timeStr: string): boolean => {
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

  let totalSynced = 0, totalConflict = 0
  const syncedMemberIds: string[] = []

  for (const plan of plans) {
    const existKey = `${plan.member_id}_${plan.coach_id}_${plan.lesson_type}`
    if (existingSet.has(existKey)) {
      await supabaseAdmin.from('lesson_plans').update({ next_month_synced: true }).eq('id', plan.id)
      continue
    }

    const memberDiscount = memberDiscountMap.get(plan.member_id) ?? { discount_amount: 0, discount_memo: null }
    const slots = slotsByPlan[plan.id] ?? []
    const patternCount: Record<string, { count: number; duration: number }> = {}

    for (const slot of slots) {
      const { dow, hh, mm } = parseKSTSlot(slot.scheduled_at)
      const key = `${dow}_${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
      if (!patternCount[key]) patternCount[key] = { count: 0, duration: slot.duration_minutes }
      patternCount[key].count++
    }

    const patterns = Object.entries(patternCount)
      .filter(([key, v]) => {
        if (slots.length < 4) return v.count >= 1
        const dayOfWeek = Number(key.split('_')[0])
        const totalForDay = totalWeekdayCount[dayOfWeek] ?? 1
        return v.count >= Math.ceil(totalForDay * 0.5)
      })
      .map(([key, v]) => {
        const [day, time] = key.split('_')
        const [hh, mm] = time.split(':').map(Number)
        return { dayOfWeek: Number(day), hh, mm, duration: v.duration }
      })

    const planBase = {
      member_id: plan.member_id, coach_id: plan.coach_id, month_id: nextMonthId,
      lesson_type: plan.lesson_type, total_count: 0, billing_count: 0, completed_count: 0,
      payment_status: 'unpaid', amount: plan.amount, unit_minutes: plan.unit_minutes,
      program_id: plan.program_id ?? null, next_month_synced: false,
      discount_amount: memberDiscount.discount_amount, discount_memo: memberDiscount.discount_memo,
    }

    if (patterns.length === 0) {
      await supabaseAdmin.from('lesson_plans').insert(planBase)
      await supabaseAdmin.from('lesson_plans').update({ next_month_synced: true }).eq('id', plan.id)
      totalSynced++; syncedMemberIds.push(plan.member_id); continue
    }

    const draftSlotDates: { datetime: string; duration: number; hasConflict: boolean }[] = []
    for (const pattern of patterns) {
      for (const { day } of nextMonthDates.filter(d => d.dayOfWeek === pattern.dayOfWeek)) {
        const timeStr = `${String(pattern.hh).padStart(2, '0')}:${String(pattern.mm).padStart(2, '0')}`
        const datetime = makeKSTDatetime(nextYear, nextMonth, day, pattern.hh, pattern.mm)
        const blocked = isBlocked(plan.coach_id, nextYear, nextMonth, day, timeStr)
        if (blocked) totalConflict++
        draftSlotDates.push({ datetime, duration: pattern.duration, hasConflict: blocked })
      }
    }

    const { data: newPlan, error: planErr } = await supabaseAdmin
      .from('lesson_plans').insert(planBase).select('id').single()

    if (planErr || !newPlan) continue

    if (draftSlotDates.length > 0) {
      await supabaseAdmin.from('lesson_slots').insert(
        draftSlotDates.map(s => ({
          lesson_plan_id: newPlan.id, scheduled_at: s.datetime,
          duration_minutes: s.duration, status: 'draft',
          slot_type: 'lesson', is_makeup: false, has_conflict: s.hasConflict,
        }))
      )
    }

    existingSet.add(existKey)
    await supabaseAdmin.from('lesson_plans').update({ next_month_synced: true }).eq('id', plan.id)
    totalSynced++; syncedMemberIds.push(plan.member_id)
  }

  const uniqueMemberIds = [...new Set(syncedMemberIds)]
  if (uniqueMemberIds.length > 0) {
    await supabaseAdmin.from('notifications').insert(
      uniqueMemberIds.map((id: string) => ({
        profile_id: id,
        title: `📅 ${nextYear}년 ${nextMonth}월 수업 초안 생성`,
        body: `다음달 수업 일정 초안이 생성되었습니다. 운영자 확정 후 스케줄 탭에서 확인하세요.`,
        type: 'info', link: '/member/schedule',
      }))
    )
  }

  const { data: owners } = await supabaseAdmin
    .from('profiles').select('id').in('role', ['owner', 'admin']).eq('is_active', true)

  if (owners && owners.length > 0) {
    await supabaseAdmin.from('notifications').insert(
      owners.map((o: any) => ({
        profile_id: o.id,
        title: `🗓️ ${nextYear}년 ${nextMonth}월 수업 초안 생성 완료`,
        body: `${totalSynced}개 플랜 초안 생성${totalConflict > 0 ? ` (⚠️ 충돌 ${totalConflict}건 확인 필요)` : ''}`,
        type: totalConflict > 0 ? 'warning' : 'success', link: '/owner/schedule-draft',
      }))
    )
  }

  return NextResponse.json({ ok: true, synced: totalSynced, conflicts: totalConflict, nextMonth: `${nextYear}년 ${nextMonth}월` })
}