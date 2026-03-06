import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const { name, birth_date, notes, is_active } = await req.json()
  const { error } = await supabaseAdmin
    .from('family_members')
    .update({ name, birth_date: birth_date || null, notes: notes || null, is_active })
    .eq('id', id)
    .eq('account_id', session.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const { error } = await supabaseAdmin
    .from('family_members')
    .delete()
    .eq('id', id)
    .eq('account_id', session.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
