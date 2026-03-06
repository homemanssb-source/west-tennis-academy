import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin','payment'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const status = req.nextUrl.searchParams.get('status')
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

  if (status) query = query.eq('payment_status', status)
  if (monthId) query = query.eq('month_id', monthId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
