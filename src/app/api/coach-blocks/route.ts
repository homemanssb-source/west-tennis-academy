import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const coachId = req.nextUrl.searchParams.get('coach_id') ?? (session.role === 'coach' ? session.id : null)
  if (!coachId) return NextResponse.json([], { status: 200 })

  const { data, error } = await supabaseAdmin
    .from('coach_blocks')
    .select('*')
    .eq('coach_id', coachId)
    .order('id', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin','coach'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const { block_date, block_start, block_end, reason, repeat_weekly, day_of_week, coach_id } = body
  const coachId = session.role === 'coach' ? session.id : (coach_id ?? session.id)

  if (!repeat_weekly && !block_date) {
    return NextResponse.json({ error: '날짜 또는 요일 필요' }, { status: 400 })
  }
  if (repeat_weekly && day_of_week === undefined) {
    return NextResponse.json({ error: '요일 필요' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('coach_blocks')
    .insert({
      coach_id: coachId,
      block_date: repeat_weekly ? null : block_date,
      block_start: block_start || null,
      block_end: block_end || null,
      reason: reason || null,
      repeat_weekly: repeat_weekly ?? false,
      day_of_week: repeat_weekly ? day_of_week : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin','coach'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await req.json()

  // ✅ FIX #5: 코치는 자신의 블록만 삭제 가능
  if (session.role === 'coach') {
    const { data: block } = await supabaseAdmin
      .from('coach_blocks')
      .select('coach_id')
      .eq('id', id)
      .single()
    if (!block || block.coach_id !== session.id) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }
  }

  const { error } = await supabaseAdmin.from('coach_blocks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}