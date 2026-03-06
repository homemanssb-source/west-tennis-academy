import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const year = parseInt(req.nextUrl.searchParams.get('year') ?? String(new Date().getFullYear()))

  // 해당 연도 months 조회
  const { data: months } = await supabaseAdmin
    .from('months')
    .select('id, month')
    .eq('year', year)
    .order('month')

  if (!months || months.length === 0) {
    return NextResponse.json({ year, monthly: [] })
  }

  // 각 month별 레슨플랜 집계
  const monthIds = months.map((m: any) => m.id)
  const { data: plans } = await supabaseAdmin
    .from('lesson_plans')
    .select('month_id, payment_status, amount')
    .in('month_id', monthIds)

  const monthMap: Record<string, any> = {}
  months.forEach((m: any) => {
    monthMap[m.id] = { month: m.month, paid: 0, unpaid: 0, total: 0, paidCount: 0, unpaidCount: 0 }
  })

  ;(plans ?? []).forEach((p: any) => {
    const m = monthMap[p.month_id]
    if (!m) return
    const amt = p.amount ?? 0
    if (p.payment_status === 'paid') { m.paid += amt; m.paidCount++ }
    else { m.unpaid += amt; m.unpaidCount++ }
    m.total += amt
  })

  const monthly = Object.values(monthMap).sort((a: any, b: any) => a.month - b.month)
  const totalPaid   = monthly.reduce((s: number, m: any) => s + m.paid, 0)
  const totalUnpaid = monthly.reduce((s: number, m: any) => s + m.unpaid, 0)

  return NextResponse.json({ year, monthly, totalPaid, totalUnpaid })
}
