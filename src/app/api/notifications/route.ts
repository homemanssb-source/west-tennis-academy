import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('profile_id', session.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', session.id)
    .eq('is_read', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { profile_id, title, body, type, link } = await req.json()
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({ profile_id, title, body, type: type || 'info', link })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}