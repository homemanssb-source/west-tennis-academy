import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const date    = searchParams.get('date')
  const from    = searchParams.get('from')
  const to      = searchParams.get('to')
  const coachId = searchParams.get('coach_id')

  // date 또는 from/to 둘 중 하나 필요
  if (!date && !from) return NextResponse.json({ error: 'date 또는 from 파라미터 필요' }, { status: 400 })

  let startStr: string
  let endStr:   string

  if (date) {
    startStr = `${date}T00:00:00+09:00`
    endStr   = `${date}T23:59:59+09:00`
  } else {
    startStr = `${from}T00:00:00+09:00`
    endStr   = `${to}T23:59:59+09:00`
  }

  const { data, error } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, status, slot_type, is_makeup, memo,
      lesson_plan:lesson_plan_id (
        id, lesson_type, unit_minutes,
        member:member_id ( id, name, phone ),
        coach:coach_id ( id, name )
      )
    `)
    .gte('scheduled_at', startStr)
    .lte('scheduled_at', endStr)
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 코치 필터
  const filtered = coachId
    ? data.filter((s: any) => s.lesson_plan?.coach?.id === coachId)
    : data

  return NextResponse.json(filtered)
}
