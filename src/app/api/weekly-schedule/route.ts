import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const week = req.nextUrl.searchParams.get('week') // YYYY-MM-DD (월요일)
  if (!week) return NextResponse.json({ error: 'week 필요' }, { status: 400 })

  const start = new Date(week)
  const end   = new Date(week)
  end.setDate(end.getDate() + 6)

  const startStr = `${start.toISOString().split('T')[0]}T00:00:00+09:00`
  const endStr   = `${end.toISOString().split('T')[0]}T23:59:59+09:00`

  const { data: slots } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, status, is_makeup,
      lesson_plan:lesson_plan_id (
        lesson_type,
        member:member_id ( id, name ),
        coach:coach_id ( id, name )
      )
    `)
    .gte('scheduled_at', startStr)
    .lte('scheduled_at', endStr)
    .order('scheduled_at', { ascending: true })

  return NextResponse.json(slots ?? [])
}