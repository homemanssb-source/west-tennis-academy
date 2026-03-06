import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('member_applications')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await params
  const { action } = await req.json()

  if (action === 'reject') {
    const { error } = await supabaseAdmin
      .from('member_applications')
      .update({ status: 'rejected', reviewed_by: session.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'approve') {
    const { data: app, error: appErr } = await supabaseAdmin
      .from('member_applications')
      .select('*')
      .eq('id', id)
      .single()
    if (appErr) return NextResponse.json({ error: appErr.message }, { status: 500 })

    const tempPin = '123456'
    const pin_hash = await bcrypt.hash(tempPin, 10)

    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .insert({
        name:            app.name,
        phone:           app.phone,
        role:            'member',
        pin_hash,
        pin_must_change: true,
        is_active:       true,
      })
    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

    await supabaseAdmin
      .from('member_applications')
      .update({ status: 'approved', reviewed_by: session.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ ok: true, temp_pin: tempPin })
  }

  return NextResponse.json({ error: '잘못된 action' }, { status: 400 })
}
