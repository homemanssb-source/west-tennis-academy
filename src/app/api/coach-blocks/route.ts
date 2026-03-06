import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const coachId = req.nextUrl.searchParams.get('coach_id') ?? (session.role === 'coach' ? session.id : null)
  if (!coachId) return NextResponse.json([], { status: 200 })

  const { data, error } = await supabaseAdmin
    .from('coach_blocks')
    .select('*')
    .eq('coach_id', coachId)
    .order('block_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin','coach'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { block_date, block_start, block_end, reason } = await req.json()
  const coachId = session.role === 'coach' ? session.id : (await req.json().catch(() => ({}))).coach_id ?? session.id

  if (!block_date) return NextResponse.json({ error: '날짜 필요' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('coach_blocks')
    .insert({ coach_id: session.role === 'coach' ? session.id : coachId, block_date, block_start: block_start || null, block_end: block_end || null, reason: reason || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
