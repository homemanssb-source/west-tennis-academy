import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const monthId = searchParams.get('month_id')

  let query = supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, payment_status, amount, lesson_type, total_count, completed_count,
      coach:profiles!lesson_plans_coach_id_fkey(id, name),
      month:months(id, year, month)
    `)

  if (monthId) query = query.eq('month_id', monthId)

  const { data: plans, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!plans || plans.length === 0) {
    return NextResponse.json({ summary: [], coachStats: [], totalUnpaid: 0, totalPaid: 0 })
  }

  // 전체 합계
  const totalPaid   = plans.filter(p => p.payment_status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
  const totalUnpaid = plans.filter(p => p.payment_status === 'unpaid').reduce((s, p) => s + (p.amount || 0), 0)
  const totalSlots  = plans.reduce((s, p) => s + (p.total_count || 0), 0)
  const doneSlots   = plans.reduce((s, p) => s + (p.completed_count || 0), 0)

  // 코치별 통계
  const coachMap: Record<string, {
    id: string; name: string
    totalCount: number; completedCount: number
    paidAmount: number; unpaidAmount: number; planCount: number
  }> = {}

  for (const p of plans) {
    const coach = p.coach as { id: string; name: string } | null
    if (!coach) continue
    if (!coachMap[coach.id]) {
      coachMap[coach.id] = { id: coach.id, name: coach.name, totalCount: 0, completedCount: 0, paidAmount: 0, unpaidAmount: 0, planCount: 0 }
    }
    coachMap[coach.id].planCount     += 1
    coachMap[coach.id].totalCount    += p.total_count || 0
    coachMap[coach.id].completedCount += p.completed_count || 0
    if (p.payment_status === 'paid')   coachMap[coach.id].paidAmount   += p.amount || 0
    if (p.payment_status === 'unpaid') coachMap[coach.id].unpaidAmount += p.amount || 0
  }

  const coachStats = Object.values(coachMap).sort((a, b) => b.totalCount - a.totalCount)

  return NextResponse.json({
    totalPaid,
    totalUnpaid,
    totalSlots,
    doneSlots,
    planCount: plans.length,
    coachStats,
  })
}
