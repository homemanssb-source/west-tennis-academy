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
      month:months(id, year, month)
    `)
    .order('created_at', { ascending: false })

  if (month_id)  query = query.eq('month_id', month_id)
  if (coach_id)  query = query.eq('coach_id', coach_id)
  if (member_id) query = query.eq('member_id', member_id)
  if (payment)   query = query.eq('payment_status', payment)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
