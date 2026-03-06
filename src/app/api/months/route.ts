import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('months')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { year, month, start_date, end_date } = await req.json()
  if (!year || !month || !start_date || !end_date) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('months')
    .insert({ year, month, start_date, end_date })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '이미 등록된 월입니다' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
