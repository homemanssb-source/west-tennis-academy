// src/app/api/lesson-applications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// 코치/관리자: 승인·거절
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['coach', 'owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await req.json()
  const { action, coach_note, admin_note, requested_at, coach_id } = body

  let newStatus: string
  if (action === 'coach_approve') newStatus = 'pending_admin'
  else if (action === 'coach_reject') newStatus = 'rejected'
  else if (action === 'admin_approve') newStatus = 'approved'
  else if (action === 'admin_reject') newStatus = 'rejected'
  else return NextResponse.json({ error: '잘못된 action' }, { status: 400 })

  const updateData: Record<string, unknown> = { status: newStatus }
  if (coach_note !== undefined) updateData.coach_note = coach_note
  if (admin_note !== undefined) updateData.admin_note = admin_note
  if (requested_at) updateData.requested_at = requested_at
  if (coach_id) updateData.coach_id = coach_id

  const { data, error } = await supabaseAdmin
    .from('lesson_applications')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (action === 'admin_approve') {
    const { error: rpcError } = await supabaseAdmin.rpc('approve_lesson_application', { app_id: id })
    if (rpcError) console.error('rpc error:', rpcError)

    if (coach_id && data.lesson_plan_id) {
      await supabaseAdmin
        .from('lesson_plans')
        .update({ coach_id })
        .eq('id', data.lesson_plan_id)
    }
  }

  // 승인/거절 알림
  const memberId = data.member_id
  if (memberId) {
    const notifs = []
    if (action === 'coach_approve') {
      notifs.push({
        profile_id: memberId,
        title: '✅ 코치 확인 완료',
        body: `수업 신청이 코치 확인되었습니다. 최종 승인 대기 중입니다.`,
        type: 'info',
        link: '/member/schedule',
      })
    } else if (action === 'coach_reject') {
      notifs.push({
        profile_id: memberId,
        title: '❌ 수업 신청 거절',
        body: `코치가 수업 신청을 거절하였습니다.${coach_note ? ' 사유: ' + coach_note : ''}`,
        type: 'warning',
        link: '/member/schedule',
      })
    } else if (action === 'admin_approve') {
      notifs.push({
        profile_id: memberId,
        title: '🎾 수업 확정',
        body: `수업 신청이 최종 승인되었습니다. 수업 일정을 확인해 주세요.`,
        type: 'info',
        link: '/member/schedule',
      })
      const finalCoachId = coach_id ?? data.coach_id
      if (finalCoachId) {
        notifs.push({
          profile_id: finalCoachId,
          title: '📅 수업 일정 확정',
          body: `새 수업 일정이 확정되었습니다. 스케줄을 확인해 주세요.`,
          type: 'info',
          link: '/coach/schedule',
        })
      }
    } else if (action === 'admin_reject') {
      notifs.push({
        profile_id: memberId,
        title: '❌ 수업 신청 최종 거절',
        body: `수업 신청이 최종 거절되었습니다.${admin_note ? ' 사유: ' + admin_note : ''}`,
        type: 'warning',
        link: '/member/schedule',
      })
    }
    if (notifs.length > 0) await supabaseAdmin.from('notifications').insert(notifs)
  }

  return NextResponse.json(data)
}

// ✅ 추가: 회원 본인 신청 취소 (pending_coach 상태만)
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await context.params

  // 신청 정보 조회
  const { data: app, error: fetchErr } = await supabaseAdmin
    .from('lesson_applications')
    .select('id, member_id, status, coach_id')
    .eq('id', id)
    .single()

  if (fetchErr || !app) return NextResponse.json({ error: '신청 정보 없음' }, { status: 404 })

  // 본인 신청인지 확인
  if (app.member_id !== session.id) {
    return NextResponse.json({ error: '본인 신청만 취소 가능합니다' }, { status: 403 })
  }

  // pending_coach 상태만 취소 가능 (코치가 아직 확인 전)
  if (app.status !== 'pending_coach') {
    return NextResponse.json({
      error: '코치 대기 상태에서만 취소 가능합니다. 코치 또는 관리자에게 문의하세요.'
    }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('lesson_applications')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 코치에게 취소 알림
  await supabaseAdmin.from('notifications').insert({
    profile_id: app.coach_id,
    title: '🔔 수업 신청 취소',
    body: `${session.name}님이 수업 신청을 취소했습니다.`,
    type: 'info',
    link: '/coach/applications',
  })

  return NextResponse.json({ ok: true })
}