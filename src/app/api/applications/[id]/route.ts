import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// PATCH - 상태 변경 (코치: 수락/거절, 관리자: 최종 승인/거절/수정)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { action, coach_note, admin_note, requested_at, coach_id } = body

  const { data: app, error: fetchErr } = await supabaseAdmin
    .from('lesson_applications')
    .select('*, member:profiles!lesson_applications_member_id_fkey(id, name), coach:profiles!lesson_applications_coach_id_fkey(id, name)')
    .eq('id', id)
    .single()

  if (fetchErr || !app) return NextResponse.json({ error: '신청 없음' }, { status: 404 })

  // 코치 처리
  if (action === 'coach_approve') {
    if (session.role !== 'coach' && !['owner', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }
    const { error } = await supabaseAdmin
      .from('lesson_applications')
      .update({ status: 'pending_admin', coach_note: coach_note ?? null })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', ['owner', 'admin'])
    for (const admin of admins ?? []) {
      await supabaseAdmin.from('notifications').insert({
        profile_id: admin.id,
        title: '수업 신청 승인 대기',
        body: `${(app.member as any)?.name}님 신청 — ${(app.coach as any)?.name} 코치 확인 완료. 최종 승인해주세요.`,
        type: 'info',
        link: '/owner/applications',
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'coach_reject') {
    if (session.role !== 'coach' && !['owner', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }
    const { error } = await supabaseAdmin
      .from('lesson_applications')
      .update({ status: 'rejected', coach_note: coach_note ?? null })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabaseAdmin.from('notifications').insert({
      profile_id: app.member_id,
      title: '수업 신청 거절',
      body: `${(app.coach as any)?.name} 코치가 수업 신청을 거절했습니다.${coach_note ? ' 사유: ' + coach_note : ''}`,
      type: 'warning',
      link: '/member/schedule',
    })
    return NextResponse.json({ ok: true })
  }

  // 관리자 최종 승인
  if (action === 'admin_approve') {
    if (!['owner', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }

    const finalTime    = requested_at ?? app.requested_at
    const finalCoachId = coach_id ?? app.coach_id

    let { data: plan } = await supabaseAdmin
      .from('lesson_plans')
      .select('id, total_count')
      .eq('member_id', app.member_id)
      .eq('coach_id', finalCoachId)
      .eq('month_id', app.month_id)
      .single()

    if (!plan) {
      const { data: newPlan, error: planErr } = await supabaseAdmin
        .from('lesson_plans')
        .insert({
          member_id: app.member_id,
          coach_id: finalCoachId,
          month_id: app.month_id,
          lesson_type: app.lesson_type,
          unit_minutes: app.duration_minutes,
          total_count: 1,
          completed_count: 0,
          payment_status: 'unpaid',
          amount: 0,
        })
        .select('id, total_count')
        .single()
      if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })
      plan = newPlan
    } else {
      await supabaseAdmin
        .from('lesson_plans')
        .update({ total_count: (plan.total_count ?? 0) + 1 })
        .eq('id', plan.id)
    }

    const { error: slotErr } = await supabaseAdmin
      .from('lesson_slots')
      .insert({
        lesson_plan_id: plan.id,
        scheduled_at: finalTime,
        duration_minutes: app.duration_minutes,
        status: 'scheduled',
        is_makeup: false,
        slot_type: 'lesson',
      })
    if (slotErr) return NextResponse.json({ error: slotErr.message }, { status: 500 })

    await supabaseAdmin
      .from('lesson_applications')
      .update({ status: 'approved', admin_note: admin_note ?? null })
      .eq('id', id)

    const dt = new Date(finalTime)
    const timeStr =
      dt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) +
      ' ' +
      dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

    await supabaseAdmin.from('notifications').insert({
      profile_id: app.member_id,
      title: '수업 신청 확정 🎾',
      body: `${timeStr} 수업이 확정되었습니다.`,
      type: 'success',
      link: '/member/schedule',
    })

    return NextResponse.json({ ok: true })
  }

  // 관리자 거절
  if (action === 'admin_reject') {
    if (!['owner', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }
    await supabaseAdmin
      .from('lesson_applications')
      .update({ status: 'rejected', admin_note: admin_note ?? null })
      .eq('id', id)

    await supabaseAdmin.from('notifications').insert({
      profile_id: app.member_id,
      title: '수업 신청 거절',
      body: `수업 신청이 거절되었습니다.${admin_note ? ' 사유: ' + admin_note : ''}`,
      type: 'warning',
      link: '/member/schedule',
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
}