import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, payment_status, amount, lesson_type, total_count, completed_count, unit_minutes, created_at,
      coach:coach_id ( id, name ),
      month:month_id ( id, year, month )
    `)
    .eq('member_id', session.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
