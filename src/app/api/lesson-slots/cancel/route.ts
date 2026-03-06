import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin','coach'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { slot_id, reason } = await req.json()
  if (!slot_id) return NextResponse.json({ error: 'slot_id 필요' }, { status: 400 })

  // 슬롯 정보 조회
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

  const plan = slot.lesson_plan as any

  // 슬롯 삭제
  await supabaseAdmin.from('lesson_slots').delete().eq('id', slot_id)

  // total_count 감소
  if (plan?.id) {
    const { data: currentPlan } = await supabaseAdmin
      .from('lesson_plans')
      .select('total_count')
      .eq('id', plan.id)
      .single()
    if (currentPlan && currentPlan.total_count > 0) {
      await supabaseAdmin
        .from('lesson_plans')
        .update({ total_count: currentPlan.total_count - 1 })
        .eq('id', plan.id)
    }
  }

  // 회원에게 취소 알림 발송
  if (plan?.member_id) {
    const dt = new Date(slot.scheduled_at)
    const timeStr = dt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) +
      ' ' + dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

    await supabaseAdmin.from('notifications').insert({
      profile_id: plan.member_id,
      title: '⚠️ 수업 취소 안내',
      body: `${timeStr} ${plan.lesson_type} 수업이 취소되었습니다.${reason ? ' 사유: ' + reason : ''}`,
      type: 'warning',
      link: '/member/schedule',
    })
  }

  return NextResponse.json({ ok: true })
}
