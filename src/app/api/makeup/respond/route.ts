import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notify } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

    const { makeupRequestId, action, reason } = await request.json()

    const admin = await createAdminClient()
    const { data: req } = await admin
      .from('makeup_requests')
      .select('*, profiles!makeup_requests_member_id_fkey(phone, name)')
      .eq('id', makeupRequestId)
      .single()

    if (!req) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 })
    if (req.coach_id !== user.id) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    if (req.status !== 'pending') return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 })

    const member = req.profiles as any

    if (action === 'approve') {
      const { data: originalSlot } = await admin
        .from('lesson_slots')
        .select('lesson_plan_id')
        .eq('id', req.original_slot_id)
        .single()

      const { data: newSlot } = await admin
        .from('lesson_slots')
        .insert({
          lesson_plan_id: originalSlot?.lesson_plan_id,
          member_id: req.member_id,
          coach_id: req.coach_id,
          scheduled_at: req.requested_at,
          status: 'scheduled',
          is_makeup: true,
          duration_min: 60,
        })
        .select()
        .single()

      await admin
        .from('makeup_requests')
        .update({
          status: 'approved',
          responded_by: user.id,
          responded_at: new Date().toISOString(),
          makeup_slot_id: newSlot?.id,
        })
        .eq('id', makeupRequestId)

      await notify({
        recipientId: req.member_id,
        phone: member.phone,
        event: 'makeup_approved',
        data: { confirmedAt: new Date(req.requested_at).toLocaleString('ko-KR') },
      })

    } else if (action === 'reject') {
      await admin
        .from('makeup_requests')
        .update({
          status: 'rejected',
          response_reason: reason,
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', makeupRequestId)

      await notify({
        recipientId: req.member_id,
        phone: member.phone,
        event: 'makeup_rejected',
        data: { reason: reason ?? '사유 없음' },
      })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('보강 응답 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}