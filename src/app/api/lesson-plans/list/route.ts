import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const month_id  = searchParams.get('month_id')
  const coach_id  = searchParams.get('coach_id')
  const member_id = searchParams.get('member_id')
  const payment   = searchParams.get('payment_status')

  let query = supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, lesson_type, unit_minutes, total_count, completed_count,
      payment_status, amount, created_at,
      member:profiles!lesson_plans_member_id_fkey(id, name, phone),
      coach:profiles!lesson_plans_coach_id_fkey(id, name),
      month:months(id, year, month),
      slots:lesson_slots(id, status)
    `)
    .order('created_at', { ascending: false })

  if (month_id)  query = query.eq('month_id', month_id)
  if (coach_id)  query = query.eq('coach_id', coach_id)
  if (member_id) query = query.eq('member_id', member_id)
  if (payment)   query = query.eq('payment_status', payment)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // total_count를 실제 슬롯 수로 보정
  const plans = (data ?? []).map((p: any) => ({
    ...p,
    total_count:      p.slots?.length ?? p.total_count,
    completed_count:  p.slots?.filter((s: any) => s.status === 'completed').length ?? p.completed_count,
  }))

  // ✅ fix: family_member_name 주입
  const planIds = plans.map((p: any) => p.id)
  const familyNameMap: Record<string, string> = {}

  if (planIds.length > 0) {
    const { data: apps } = await supabaseAdmin
      .from('lesson_applications')
      .select('lesson_plan_id, family_member_id')
      .in('lesson_plan_id', planIds)
      .not('family_member_id', 'is', null)

    if (apps && apps.length > 0) {
      const familyIds = [...new Set(apps.map((a: any) => a.family_member_id).filter(Boolean))]
      const { data: familyMembers } = await supabaseAdmin
        .from('family_members')
        .select('id, name')
        .in('id', familyIds)

      const fmMap = new Map((familyMembers ?? []).map((f: any) => [f.id, f.name]))
      apps.forEach((a: any) => {
        if (a.lesson_plan_id && a.family_member_id && fmMap.has(a.family_member_id)) {
          familyNameMap[a.lesson_plan_id] = fmMap.get(a.family_member_id)!
        }
      })
    }
  }

  const result = plans.map((p: any) => ({
    ...p,
    family_member_name: familyNameMap[p.id] ?? null,
  }))

  return NextResponse.json(result)
}