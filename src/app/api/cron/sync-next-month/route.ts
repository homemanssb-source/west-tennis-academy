import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  // 매월 25일 실행 (15일 → 25일로 변경: 이달 수업 패턴이 충분히 쌓인 후)
  if (kst.getDate() !== 25) return NextResponse.json({ ok: true, skipped: 'not 25th' })

  const thisYear  = kst.getFullYear()
  const thisMonth = kst.getMonth() + 1
  const nextMonth = thisMonth === 12 ? 1 : thisMonth + 1
  const nextYear  = thisMonth === 12 ? thisYear + 1 : thisYear

  // ── 다음달 month 레코드 확인 / 자동 생성 ─────────────────────────────
  const { data: nextMonthRecord } = await supabaseAdmin
    .from('months')
    .select('id')
    .eq('year', nextYear)
    .eq('month', nextMonth)
    .single()

  let nextMonthId = nextMonthRecord?.id
  if (!nextMonthId) {
    const startDate = new Date(nextYear, nextMonth - 1, 1).toISOString().split('T')[0]
    const endDate   = new Date(nextYear, nextMonth, 0).toISOString().split('T')[0]
    const { data: created, error: createErr } = await supabaseAdmin
      .from('months')
      .insert({ year: nextYear, month: nextMonth, start_date: startDate, end_date: endDate })
      .select('id')
      .single()
    if (createErr) return NextResponse.json({ error: '다음달 month 생성 실패: ' + createErr.message }, { status: 500 })
    nextMonthId = created?.id
  }
  if (!nextMonthId) return NextResponse.json({ error: '다음달 month 없음' }, { status: 500 })

  // ── 이번달 month 조회 ────────────────────────────────────────────────
  const { data: currentMonthRecord } = await supabaseAdmin
    .from('months')
    .select('id')
    .eq('year', thisYear)
    .eq('month', thisMonth)
    .single()

  if (!currentMonthRecord) return NextResponse.json({ ok: true, skipped: 'no current month' })

  // ── 이번달 레슨플랜 조회 (next_month_synced = false) ─────────────────
  const { data: plans } = await supabaseAdmin
    .from('lesson_plans')
    .select('*')
    .eq('month_id', currentMonthRecord.id)
    .eq('next_month_synced', false)

  if (!plans || plans.length === 0) return NextResponse.json({ ok: true, synced: 0 })

  // ── 다음달에 이미 있는 플랜 확인 (중복 방지) ─────────────────────────
  const { data: existingNextPlans } = await supabaseAdmin
    .from('lesson_plans')
    .select('member_id, coach_id')
    .eq('month_id', nextMonthId)

  const existingSet = new Set(
    (existingNextPlans ?? []).map((p: any) => `${p.member_id}_${p.coach_id}`)
  )

  // ── 코치 휴무 조회 (다음달 충돌 체크용) ──────────────────────────────
  const { data: coachBlocks } = await supabaseAdmin
    .from('coach_blocks')
    .select('*')

  const blocks = coachBlocks ?? []

  // ── 이번달 슬롯 조회 (패턴 추출용) ──────────────────────────────────
  const planIds = plans.map((p: any) => p.id)
  const { data: thisMonthSlots } = await supabaseAdmin
    .from('lesson_slots')
    .select('lesson_plan_id, scheduled_at, duration_minutes, status, is_makeup')
    .in('lesson_plan_id', planIds)
    .not('status', 'in', '("cancelled","draft")')
    .eq('is_makeup', false)

  // plan_id별 슬롯 그룹핑
  const slotsByPlan: Record<string, any[]> = {}
  for (const slot of (thisMonthSlots ?? [])) {
    if (!slotsByPlan[slot.lesson_plan_id]) slotsByPlan[slot.lesson_plan_id] = []
    slotsByPlan[slot.lesson_plan_id].push(slot)
  }

  // ── 다음달 날짜별 요일 맵 ──────────────────────────────────────────
  const nextMonthDates: { date: Date; dayOfWeek: number }[] = []
  const daysInNextMonth = new Date(nextYear, nextMonth, 0).getDate()
  for (let d = 1; d <= daysInNextMonth; d++) {
    const date = new Date(nextYear, nextMonth - 1, d)
    nextMonthDates.push({ date, dayOfWeek: date.getDay() })
  }

  // 휴무 충돌 체크 함수
  const isBlocked = (coachId: string, dateObj: Date, timeStr: string): boolean => {
    const dateStr = dateObj.toISOString().split('T')[0]
    const dayOfWeek = dateObj.getDay()
    return blocks.some((b: any) => {
      if (b.coach_id !== coachId) return false
      // 특정 날짜 휴무
      if (b.block_date && b.block_date === dateStr) {
        if (!b.block_start) return true // 하루 종일
        return timeStr >= b.block_start && timeStr <= (b.block_end ?? '23:59')
      }
      // 주간 반복 휴무
      if (b.repeat_weekly && b.day_of_week === dayOfWeek) {
        if (!b.block_start) return true
        return timeStr >= b.block_start && timeStr <= (b.block_end ?? '23:59')
      }
      return false
    })
  }

  let totalSynced = 0
  let totalConflict = 0
  const syncedMemberIds: string[] = []

  for (const plan of plans) {
    // 이미 다음달에 있으면 synced 표시만
    if (existingSet.has(`${plan.member_id}_${plan.coach_id}`)) {
      await supabaseAdmin
        .from('lesson_plans')
        .update({ next_month_synced: true })
        .eq('id', plan.id)
      continue
    }

    // ── 슬롯 패턴 추출 ────────────────────────────────────────────────
    const slots = slotsByPlan[plan.id] ?? []
    const patternCount: Record<string, { count: number; duration: number }> = {}

    for (const slot of slots) {
      const d = new Date(slot.scheduled_at)
      const dayOfWeek = d.getDay()
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      const key = `${dayOfWeek}_${hh}:${mm}`
      if (!patternCount[key]) patternCount[key] = { count: 0, duration: slot.duration_minutes }
      patternCount[key].count++
    }

    // threshold: 슬롯이 적을 때는 1회도 패턴으로 인정
    const threshold = Math.max(1, Math.floor(slots.length / 6))
    const patterns = Object.entries(patternCount)
      .filter(([, v]) => v.count >= threshold)
      .map(([key, v]) => {
        const [day, time] = key.split('_')
        return { dayOfWeek: Number(day), time, duration: v.duration }
      })

    // 패턴이 없으면 플랜 껍데기만 복사
    if (patterns.length === 0) {
      await supabaseAdmin.from('lesson_plans').insert({
        member_id:        plan.member_id,
        coach_id:         plan.coach_id,
        month_id:         nextMonthId,
        lesson_type:      plan.lesson_type,
        total_count:      0,
        completed_count:  0,
        payment_status:   'unpaid',
        amount:           plan.amount,
        unit_minutes:     plan.unit_minutes,
        program_id:       plan.program_id ?? null,
        next_month_synced: false,
      })
      await supabaseAdmin.from('lesson_plans').update({ next_month_synced: true }).eq('id', plan.id)
      totalSynced++
      syncedMemberIds.push(plan.member_id)
      continue
    }

    // ── 다음달 슬롯 초안 생성 ─────────────────────────────────────────
    // 패턴별 다음달 날짜 찾기
    const draftSlotDates: { datetime: string; duration: number; hasConflict: boolean }[] = []

    for (const pattern of patterns) {
      const matchingDates = nextMonthDates.filter(d => d.dayOfWeek === pattern.dayOfWeek)
      for (const { date } of matchingDates) {
        const [hh, mm] = pattern.time.split(':')
        const slotDate = new Date(nextYear, nextMonth - 1, date.getDate(),
          Number(hh), Number(mm), 0)
        const isoStr = slotDate.toISOString()
        // KST 보정
        const kstStr = new Date(slotDate.getTime() + 9 * 60 * 60 * 1000)
          .toISOString().replace('Z', '+09:00')
          .replace(/\.\d{3}\+09:00$/, '+09:00')

        const blocked = isBlocked(plan.coach_id, date, pattern.time)
        if (blocked) totalConflict++

        draftSlotDates.push({
          datetime: isoStr,
          duration: pattern.duration,
          hasConflict: blocked,
        })
      }
    }

    // 다음달 플랜 생성
    const { data: newPlan, error: planErr } = await supabaseAdmin
      .from('lesson_plans')
      .insert({
        member_id:        plan.member_id,
        coach_id:         plan.coach_id,
        month_id:         nextMonthId,
        lesson_type:      plan.lesson_type,
        total_count:      0, // 확정 시 업데이트
        completed_count:  0,
        payment_status:   'unpaid',
        amount:           plan.amount,
        unit_minutes:     plan.unit_minutes,
        program_id:       plan.program_id ?? null,
        next_month_synced: false,
      })
      .select('id')
      .single()

    if (planErr || !newPlan) continue

    // draft 슬롯 생성
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

    // 이번달 플랜 synced 처리
    await supabaseAdmin.from('lesson_plans').update({ next_month_synced: true }).eq('id', plan.id)
    totalSynced++
    syncedMemberIds.push(plan.member_id)
  }

  // ── 알림 발송 ────────────────────────────────────────────────────────
  // 회원 알림
  const uniqueMemberIds = [...new Set(syncedMemberIds)]
  if (uniqueMemberIds.length > 0) {
    const memberNotifs = uniqueMemberIds.map((id: string) => ({
      profile_id: id,
      title: `📅 ${nextYear}년 ${nextMonth}월 수업 초안 생성`,
      body: `다음달 수업 일정 초안이 생성되었습니다. 운영자 확정 후 확인하세요.`,
      type: 'info',
      link: '/member/schedule',
    }))
    await supabaseAdmin.from('notifications').insert(memberNotifs)
  }

  // 운영자 알림
  const { data: owners } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role', ['owner', 'admin'])
    .eq('is_active', true)

  if (owners && owners.length > 0) {
    const ownerNotifs = owners.map((o: any) => ({
      profile_id: o.id,
      title: `🗓️ ${nextYear}년 ${nextMonth}월 수업 초안 생성 완료`,
      body: `${totalSynced}개 플랜 초안 생성${totalConflict > 0 ? ` (⚠️ 충돌 ${totalConflict}건 확인 필요)` : ''}`,
      type: totalConflict > 0 ? 'warning' : 'success',
      link: '/owner/schedule-draft',
    }))
    await supabaseAdmin.from('notifications').insert(ownerNotifs)
  }

  return NextResponse.json({
    ok: true,
    synced: totalSynced,
    conflicts: totalConflict,
    nextMonth: `${nextYear}년 ${nextMonth}월`,
  })
}