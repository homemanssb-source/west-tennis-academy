import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()

  if (body.action === 'toggle_active') {
    const { data: cur } = await supabaseAdmin.from('lesson_programs').select('is_active').eq('id', id).single()
    const { error } = await supabaseAdmin.from('lesson_programs').update({ is_active: !cur?.is_active }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { name, ratio, max_students, unit_minutes, description } = body
  const { error } = await supabaseAdmin
    .from('lesson_programs')
    .update({ name, ratio, max_students, unit_minutes, description })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const { error } = await supabaseAdmin.from('lesson_programs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
