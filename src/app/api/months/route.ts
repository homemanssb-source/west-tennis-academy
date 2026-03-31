// src/app/api/months/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '沅뚰븳 ?놁쓬' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('months')
    .select('*')
    .order('year',  { ascending: false })
    .order('month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '沅뚰븳 ?놁쓬' }, { status: 403 })
  }

  const { year, month, start_date, end_date } = await req.json()
  if (!year || !month || !start_date || !end_date) {
    return NextResponse.json({ error: '?꾩닔 ??ぉ ?꾨씫' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('months')
    .insert({ year, month, start_date, end_date })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '?대? ?깅줉???붿엯?덈떎' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// draft_open ?좉? + registration_open ?좉? (?댁쁺??愿由ъ옄留?
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '沅뚰븳 ?놁쓬' }, { status: 403 })
  }

  const body = await req.json()
  const { month_id } = body

  if (!month_id) {
    return NextResponse.json({ error: '?꾩닔 ??ぉ ?꾨씫' }, { status: 400 })
  }

  // draft_open ?좉?
  if (body.draft_open !== undefined) {
    const { error } = await supabaseAdmin
      .from('months')
      .update({ draft_open: body.draft_open })
      .eq('id', month_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, draft_open: body.draft_open })
  }

  // registration_open ?좉?
  if (body.registration_open !== undefined) {
    const { error } = await supabaseAdmin
      .from('months')
      .update({ registration_open: body.registration_open })
      .eq('id', month_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, registration_open: body.registration_open })
  }

  return NextResponse.json({ error: '蹂寃쏀븷 ?꾨뱶 ?놁쓬' }, { status: 400 })
}
