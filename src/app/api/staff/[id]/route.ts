import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()

  if (body.action === 'reset_pin') {
    const tempPin = '123456'
    const pin_hash = await bcrypt.hash(tempPin, 10)
    const { error } = await supabaseAdmin.from('profiles').update({ pin_hash, pin_must_change: true }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, temp_pin: tempPin })
  }

  if (body.action === 'toggle_active') {
    const { data: cur } = await supabaseAdmin.from('profiles').select('is_active').eq('id', id).single()
    const { error } = await supabaseAdmin.from('profiles').update({ is_active: !cur?.is_active }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { name, phone } = body
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ name, phone: phone?.replace(/-/g,'') })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
