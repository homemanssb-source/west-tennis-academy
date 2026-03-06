import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, status, slot_type, memo,
      lesson_plan:lesson_plan_id (
        id, lesson_type, total_count, completed_count,
        coach:coach_id ( id, name ),
        month:month_id ( id, year, month )
      )
    `)
    .eq('lesson_plan.member_id', session.id)
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
