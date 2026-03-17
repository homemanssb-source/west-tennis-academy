// src/app/api/payment/route.ts
// ✅ payments 테이블 join → toss_paid 필드 추가
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin','payment'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const status  = req.nextUrl.searchParams.get('status')
  const monthId = req.nextUrl.searchParams.get('month_id')

  let query = supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, payment_status, amount, lesson_type, total_count, completed_count, unit_minutes, created_at,
      member:member_id ( id, name, phone ),
      coach:coach_id ( id, name ),
      month:month_id ( id, year, month )
    `)
    .order('created_at', { ascending: false })

  if (status)  query = query.eq('payment_status', status)
  if (monthId) query = query.eq('month_id', monthId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const plans = data ?? []

  // ✅ 토스 결제 완료된 플랜 ID 조회 (payments.status = 'done')
  const planIds = plans.map((p: any) => p.id)
  let tossPaidSet = new Set<string>()

  if (planIds.length > 0) {
    const { data: tossPayments } = await supabaseAdmin
      .from('payments')
      .select('lesson_plan_id')
      .in('lesson_plan_id', planIds)
      .eq('status', 'done')

    tossPaidSet = new Set((tossPayments ?? []).map((p: any) => p.lesson_plan_id))
  }

  // ✅ toss_paid 필드 추가
  const result = plans.map((p: any) => ({
    ...p,
    toss_paid: tossPaidSet.has(p.id),  // 토스로 결제된 플랜 여부
  }))

  return NextResponse.json(result)
}
