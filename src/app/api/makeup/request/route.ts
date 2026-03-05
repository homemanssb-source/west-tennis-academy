import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notify } from '@/lib/notifications'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

    const { originalSlotId, requestedAt, reason } = await request.json()

    const { data: member } = await supabase
      .from('profiles')
      .select('id, name, phone, coach_id')
      .eq('id', user.id)
      .single()

    if (!member) return NextResponse.json({ error: '회원 정보를 찾을 수 없습니다.' }, { status: 404 })

    const { data: slot } = await supabase
      .from('lesson_slots')
      .select('*')
      .eq('id', originalSlotId)
      .single()

    if (!slot) return NextResponse.json({ error: '레슨 슬롯을 찾을 수 없습니다.' }, { status: 404 })
    if (slot.status !== 'cancelled') return NextResponse.json({ error: '취소된 레슨만 보강 신청이 가능합니다.' }, { status: 400 })

    const scheduledAt = new Date(slot.scheduled_at)
    const cancelledAt = slot.cancelled_at ? new Date(slot.cancelled_at) : null
    const isSameDay = cancelledAt && cancelledAt.toDateString() === scheduledAt.toDateString()

    const { data: plan } = await supabase
      .from('lesson_plans')
      .select('payment_status')
      .eq('id', slot.lesson_plan_id)
      .single()

    if (isSameDay && plan?.payment_status === 'unpaid') {
      return NextResponse.json({
        error: '당일 취소 + 미납 상태에서는 보강 신청이 불가합니다.',
        code: 'BLOCKED_SAME_DAY_UNPAID',
      }, { status: 400 })
    }

    const admin = await createAdminClient()
    const { data: makeupRequest, error: insertError } = await admin
      .from('makeup_requests')
      .insert({
        member_id: user.id,
        coach_id: member.coach_id,
        original_slot_id: originalSlotId,
        requested_at: requestedAt,
        reason,
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (insertError) throw insertError

    const { data: coach } = await supabase
      .from('profiles')
      .select('id, phone')