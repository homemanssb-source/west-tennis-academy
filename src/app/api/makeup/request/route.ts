import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function parseSession(raw: string | undefined) {
  if (!raw) return null
  try {
    const s = JSON.parse(Buffer.from(raw, 'base64').toString())
    if (s.exp < Date.now()) return null
    return s
  } catch { return null }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  try {
    const { originalSlotId, requestedAt, reason, memberId } = await request.json()
    const targetMemberId = memberId ?? session.userId

    const admin = await createAdminClient()

    const { data: member } = await admin
      .from('profiles')
      .select('id, name, coach_id')
      .eq('id', targetMemberId)
      .single()

    if (!member) return NextResponse.json({ error: '회원 정보를 찾을 수 없습니다.' }, { status: 404 })

    const { data: slot } = await admin
      .from('lesson_slots')
      .select('*')
      .eq('id', originalSlotId)
      .single()

    if (!slot) return NextResponse.json({ error: '해당 슬롯을 찾을 수 없습니다.' }, { status: 404 })
    if (slot.status !== 'cancelled') return NextResponse.json({ error: '취소된 레슨만 보강 신청 가능합니다.' }, { status: 400 })

    // 당일 취소 + 미납 차단
    const scheduledAt = new Date(slot.scheduled_at)
    const cancelledAt = slot.cancelled_at ? new Date(slot.cancelled_at) : null
    const isSameDay = cancelledAt && cancelledAt.toDateString() === scheduledAt.toDateString()

    const { data: plan } = await admin
      .from('lesson_plans')
      .select('payment_status')
      .eq('id', slot.lesson_plan_id)
      .maybeSingle()

    if (isSameDay && plan?.payment_status === 'unpaid') {
      return NextResponse.json({
        error: '당일 취소 + 미납 상태에서는 보강 신청이 불가합니다.',
        code: 'BLOCKED_SAME_DAY_UNPAID',
      }, { status: 400 })
    }

    const { data: makeupRequest, error: insertError } = await admin
      .from('makeup_requests')
      .insert({
        member_id: targetMemberId,
        coach_id: member.coach_id,
        original_slot_id: originalSlotId,
        requested_at: requestedAt,
        reason: reason ?? null,
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ success: true, requestId: makeupRequest.id })
  } catch (e) {
    console.error('보강 신청 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
