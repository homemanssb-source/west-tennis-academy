// src/app/api/lesson-slots/[id]/route.ts
// ✅ [FIX] 알림 날짜 포맷 UTC 버그 수정 (서버에서 getMonth() → KST 변환)
// ✅ [FIX] reschedule 후 recalcAndSavePlan 호출 (요일별 할증 반영)
// ✅ [FIX] 알림 fmtDt 함수 KST 기준으로 수정
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import { recalcAndSavePlan } from '@/lib/calcAmount'

/** 서버 사이드 KST 날짜/시간 포맷 유틸 */
function fmtKSTDatetime(isoStr: string): string {
  const d = new Date(isoStr)
  // UTC → KST
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const month  = kst.getUTCMonth() + 1
  const day    = kst.getUTCDate()
  const hh     = String(kst.getUTCHours()).padStart(2, '0')
  const mm     = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${month}/${day} ${hh}:${mm}`
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin', 'coach'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { status, memo, scheduled_at, swap_to_member_id } = body

  // ── 회원 변경(swap) 경로 ──────────────────────────────────────
  if (swap_to_member_id) {
    if (!['owner', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }

    // 1) 현재 슬롯 + 현재 plan 조회
    const { data: curSlot } = await supabaseAdmin
      .from('lesson_slots')
      .select(`
        id, scheduled_at, duration_minutes, status,
        lesson_plan:lesson_plan_id ( id, coach_id, month_id, lesson_type, unit_minutes, family_member_id )
      `)
      .eq('id', id)
      .single()

    if (!curSlot) return NextResponse.json({ error: '슬롯 없음' }, { status: 404 })

    const oldPlan = curSlot.lesson_plan as any
    if (!oldPlan) return NextResponse.json({ error: 'plan 정보 없음' }, { status: 400 })

    // 2) 이동 대상 회원 확인
    const { data: newMember } = await supabaseAdmin
      .from('profiles')
      .select('id, name, role')
      .eq('id', swap_to_member_id)
      .single()
    if (!newMember || newMember.role !== 'member') {
      return NextResponse.json({ error: '유효한 회원이 아닙니다' }, { status: 400 })
    }

    // 3) 새 회원이 같은 시간에 이미 다른 슬롯 있으면 삭제 (#3 정책)
    const { data: conflictSlots } = await supabaseAdmin
      .from('lesson_slots')
      .select('id, lesson_plan:lesson_plan_id!inner(member_id)')
      .eq('scheduled_at', curSlot.scheduled_at)
      .in('status', ['scheduled', 'completed'])
    const dupSlotIds = (conflictSlots ?? [])
      .filter((s: any) => (s.lesson_plan as any)?.member_id === swap_to_member_id)
      .map((s: any) => s.id)
    if (dupSlotIds.length > 0) {
      await supabaseAdmin.from('lesson_slots').delete().in('id', dupSlotIds)
    }

    // 4) 새 회원의 동일 coach/month/family(null) plan 조회 or 생성
    let { data: newPlan } = await supabaseAdmin
      .from('lesson_plans')
      .select('id')
      .eq('member_id', swap_to_member_id)
      .eq('coach_id', oldPlan.coach_id)
      .eq('month_id', oldPlan.month_id)
      .is('family_member_id', null)
      .maybeSingle()

    if (!newPlan) {
      const { data: created, error: cErr } = await supabaseAdmin
        .from('lesson_plans')
        .insert({
          member_id:        swap_to_member_id,
          coach_id:         oldPlan.coach_id,
          month_id:         oldPlan.month_id,
          lesson_type:      oldPlan.lesson_type ?? '개인레슨',
          unit_minutes:     oldPlan.unit_minutes ?? curSlot.duration_minutes,
          total_count:      0,
          completed_count:  0,
          payment_status:   'unpaid',
          amount:           0,
          family_member_id: null,
        })
        .select('id')
        .single()
      if (cErr || !created) return NextResponse.json({ error: '새 plan 생성 실패' }, { status: 500 })
      newPlan = created
    }

    // 5) 슬롯을 새 plan 에 재연결
    const { error: mvErr } = await supabaseAdmin
      .from('lesson_slots')
      .update({ lesson_plan_id: newPlan.id })
      .eq('id', id)
    if (mvErr) return NextResponse.json({ error: mvErr.message }, { status: 500 })

    // 6) 양쪽 plan 의 total_count + 금액 재계산
    for (const pid of [oldPlan.id, newPlan.id]) {
      const { count } = await supabaseAdmin
        .from('lesson_slots')
        .select('id', { count: 'exact', head: true })
        .eq('lesson_plan_id', pid)
        .in('status', ['scheduled', 'completed'])
      await supabaseAdmin.from('lesson_plans').update({ total_count: count ?? 0 }).eq('id', pid)
      await recalcAndSavePlan(pid)
    }

    // 7) 알림 (새 회원에게)
    await supabaseAdmin.from('notifications').insert({
      profile_id: swap_to_member_id,
      title: '📅 수업 일정 등록',
      body: `${fmtKSTDatetime(curSlot.scheduled_at)} 수업이 등록되었습니다.`,
      type: 'info',
      link: '/member/schedule',
    })

    return NextResponse.json({ ok: true, new_lesson_plan_id: newPlan.id })
  }

  // ── 날짜/시간 수정 경로 ──────────────────────────────────────
  if (scheduled_at !== undefined) {
    const { data: currentSlot } = await supabaseAdmin
      .from('lesson_slots')
      .select(`
        id, status, scheduled_at, duration_minutes,
        lesson_plan:lesson_plan_id (
          id,
          lesson_type,
          member:member_id ( id, name )
        )
      `)
      .eq('id', id)
      .single()

    if (!currentSlot) {
      return NextResponse.json({ error: '슬롯을 찾을 수 없습니다' }, { status: 404 })
    }

    // 코치는 scheduled 상태만 수정 가능
    if (session.role === 'coach' && currentSlot.status !== 'scheduled') {
      return NextResponse.json(
        { error: '예정 상태인 수업만 날짜/시간을 변경할 수 있습니다' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('lesson_slots')
      .update({ scheduled_at })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ✅ [FIX] KST 기준 알림 날짜 포맷
    const oldDtStr = fmtKSTDatetime(currentSlot.scheduled_at)
    const newDtStr = fmtKSTDatetime(scheduled_at)

    const plan = currentSlot.lesson_plan as any
    const memberId   = plan?.member?.id
    const lessonType = plan?.lesson_type ?? '수업'
    const planId     = plan?.id

    // 회원 알림 발송
    if (memberId) {
      await supabaseAdmin.from('notifications').insert({
        profile_id: memberId,
        title: '📅 수업 일정 변경 안내',
        body: `${lessonType} 수업 일정이 변경되었습니다.\n변경 전: ${oldDtStr}\n변경 후: ${newDtStr}`,
        type: 'info',
        link: '/member/schedule',
      })
    }

    // ✅ [NEW] 일정 변경 후 금액 재계산 (요일별 할증: sat/sun surcharge 반영)
    if (planId) {
      await recalcAndSavePlan(planId)
    }

    return NextResponse.json({ ok: true })
  }

  // ── 상태/메모 수정 경로 ──────────────────────────────────────
  const update: Record<string, unknown> = {}
  if (status !== undefined && status !== '') update.status = status
  if (memo !== undefined) update.memo = memo

  // 완료 처리 시 completed_count 증가
  if (status === 'completed') {
    const { data: slot } = await supabaseAdmin
      .from('lesson_slots')
      .select('lesson_plan_id, status')
      .eq('id', id)
      .single()

    if (slot && slot.status !== 'completed') {
      await supabaseAdmin.rpc('increment_completed', { plan_id: slot.lesson_plan_id })
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabaseAdmin.from('lesson_slots').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await params

  // ✅ 삭제 전에 lesson_plan_id 확보 (후속 금액 재계산 용)
  const { data: slotBefore } = await supabaseAdmin
    .from('lesson_slots')
    .select('lesson_plan_id')
    .eq('id', id)
    .single()

  // lesson_applications.original_slot_id 참조 해제
  await supabaseAdmin
    .from('lesson_applications')
    .update({ original_slot_id: null })
    .eq('original_slot_id', id)

  // ✅ 해당 슬롯과 연결된 lesson_applications.lesson_plan_id 해제도 고려
  //    (plan 이 비게 되는 경우 대비 — 가족 공용 plan 유지)
  const { error } = await supabaseAdmin
    .from('lesson_slots')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ✅ 금액/요일 할증/total_count 재계산
  const planId = slotBefore?.lesson_plan_id
  if (planId) {
    const { count: remaining } = await supabaseAdmin
      .from('lesson_slots')
      .select('id', { count: 'exact', head: true })
      .eq('lesson_plan_id', planId)
      .in('status', ['scheduled', 'completed'])
    await supabaseAdmin
      .from('lesson_plans')
      .update({ total_count: remaining ?? 0 })
      .eq('id', planId)
    await recalcAndSavePlan(planId)
  }

  return NextResponse.json({ ok: true })
}