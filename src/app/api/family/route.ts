import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { data, error } = await supabaseAdmin
    .from('family_members')
    .select('*')
    .eq('account_id', session.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { name, birth_date, notes } = await req.json()
  if (!name) return NextResponse.json({ error: '이름은 필수입니다' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('family_members')
    .insert({ account_id: session.id, name, birth_date: birth_date || null, notes: notes || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
