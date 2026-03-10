import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin', 'coach'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { slot_id, reason } = await req.json()
  if (!slot_id) return NextResponse.json({ error: 'slot_id 필요' }, { status: 400 })

  const { data: slot } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, status,
      lesson_plan:lesson_plan_id (
        id, lesson_type, total_count,
        member_id,
        coach:coach_id ( id, name )
      )
    `)
    .eq('id', slot_id)
    .single()

  if (!slot) return NextResponse.json({ error: '슬롯 없음' }, { status: 404 })
  if (slot.status === 'completed') return NextResponse.json({ error: '완료된 수업은 취소할 수 없습니다' }, { status: 400 })
  if (slot.status === 'cancelled') return NextResponse.json({ error: '이미 취소된 수업입니다' }, { status: 400 })

  const plan = slot.lesson_plan as any

  const { error: updateErr } = await supabaseAdmin
    .from('lesson_slots')
    .update({ status: 'cancelled', memo: reason || null })
    .eq('id', slot_id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // ✅ FIX #8: Race condition → RPC atomic decrement 사용
  if (plan?.id) {
    await supabaseAdmin.rpc('decrement_total_count', { plan_id: plan.id })
  }

  if (plan?.member_id) {
    const dt = new Date(slot.scheduled_at)
    const timeStr =
      dt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) +
      ' ' +
      dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

    await supabaseAdmin.from('notifications').insert({
      profile_id: plan.member_id,
      title: '수업 취소 안내',
      body: `${timeStr} ${plan.lesson_type} 수업이 취소되었습니다.${reason ? ' 사유: ' + reason : ''} 보강 일정은 별도 안내 예정입니다.`,
      type: 'warning',
      link: '/member/schedule',
    })
  }

  return NextResponse.json({ ok: true })
}