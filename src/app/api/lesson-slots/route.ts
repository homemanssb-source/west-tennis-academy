import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const date    = req.nextUrl.searchParams.get('date')
  const coachId = req.nextUrl.searchParams.get('coach_id')

  if (!date) return NextResponse.json({ error: 'date 파라미터 필요' }, { status: 400 })

  const start = `${date}T00:00:00+09:00`
  const end   = `${date}T23:59:59+09:00`

  let query = supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, status, slot_type, is_makeup, memo,
      lesson_plan:lesson_plan_id (
        id, lesson_type, unit_minutes,
        member:member_id ( id, name, phone ),
        coach:coach_id ( id, name )
      )
    `)
    .gte('scheduled_at', start)
    .lte('scheduled_at', end)
    .order('scheduled_at', { ascending: true })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 코치 필터
  const filtered = coachId
    ? data.filter((s: any) => s.lesson_plan?.coach?.id === coachId)
    : data

  return NextResponse.json(filtered)
}
