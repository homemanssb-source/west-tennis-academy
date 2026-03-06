import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const monthId = req.nextUrl.searchParams.get('month_id')
  if (!monthId) return NextResponse.json({ error: 'month_id 필요' }, { status: 400 })

  const [
    { data: plans },
    { data: slots },
    { data: month },
  ] = await Promise.all([
    supabaseAdmin.from('lesson_plans').select(`
      id, payment_status, amount, lesson_type, total_count, completed_count,
      member:member_id ( id, name ),
      coach:coach_id ( id, name )
    `).eq('month_id', monthId),
    supabaseAdmin.from('lesson_slots').select(`
      id, status, scheduled_at,
      lesson_plan:lesson_plan_id ( month_id, coach:coach_id(id, name) )
    `),
    supabaseAdmin.from('months').select('*').eq('id', monthId).single(),
  ])

  const monthSlots = (slots ?? []).filter((s: any) => s.lesson_plan?.month_id === monthId)

  // 통계 계산
  const totalPlans    = (plans ?? []).length
  const paidPlans     = (plans ?? []).filter((p: any) => p.payment_status === 'paid').length
  const unpaidPlans   = totalPlans - paidPlans
  const totalRevenue  = (plans ?? []).filter((p: any) => p.payment_status === 'paid').reduce((s: number, p: any) => s + (p.amount || 0), 0)
  const unpaidAmount  = (plans ?? []).filter((p: any) => p.payment_status === 'unpaid').reduce((s: number, p: any) => s + (p.amount || 0), 0)
  const totalSlots    = monthSlots.length
  const completedSlots = monthSlots.filter((s: any) => s.status === 'completed').length
  const absentSlots   = monthSlots.filter((s: any) => s.status === 'absent').length

  // 코치별 통계
  const coachMap: Record<string, { name: string; total: number; completed: number; absent: number }> = {}
  monthSlots.forEach((s: any) => {
    const cid  = s.lesson_plan?.coach?.id
    const name = s.lesson_plan?.coach?.name
    if (!cid) return
    if (!coachMap[cid]) coachMap[cid] = { name, total: 0, completed: 0, absent: 0 }
    coachMap[cid].total++
    if (s.status === 'completed') coachMap[cid].completed++
    if (s.status === 'absent')    coachMap[cid].absent++
  })

  // 회원별 통계
  const memberMap: Record<string, { name: string; total: number; completed: number; absent: number; paid: boolean; amount: number }> = {}
  ;(plans ?? []).forEach((p: any) => {
    const mid  = p.member?.id
    const name = p.member?.name
    if (!mid) return
    if (!memberMap[mid]) memberMap[mid] = { name, total: 0, completed: 0, absent: 0, paid: false, amount: 0 }
    memberMap[mid].total     += p.total_count
    memberMap[mid].completed += p.completed_count
    memberMap[mid].paid       = p.payment_status === 'paid'
    memberMap[mid].amount    += p.amount || 0
  })

  return NextResponse.json({
    month: month.data ?? month,
    summary: { totalPlans, paidPlans, unpaidPlans, totalRevenue, unpaidAmount, totalSlots, completedSlots, absentSlots },
    byCoach:  Object.values(coachMap),
    byMember: Object.values(memberMap),
  })
}
