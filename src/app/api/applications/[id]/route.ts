import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { action } = body

  // ── 가입서 내용 수정 ────────────────────────────────────────────────────
  if (action === 'edit') {
    const {
      name, phone, birth_date, address,
      emergency_contact, health_notes, desired_schedule,
    } = body

    if (!name?.trim()) return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 })
    if (!phone?.trim()) return NextResponse.json({ error: '전화번호를 입력해주세요' }, { status: 400 })

    const cleanPhone = String(phone).replace(/-/g, '')

    // member_applications 수정
    const { error: appErr } = await supabaseAdmin
      .from('member_applications')
      .update({
        name:               name.trim(),
        phone:              cleanPhone,
        birth_date:         birth_date || null,
        address:            address || null,
        emergency_contact:  emergency_contact || null,
        health_notes:       health_notes || null,
        desired_schedule:   desired_schedule || null,
      })
      .eq('id', id)

    if (appErr) return NextResponse.json({ error: appErr.message }, { status: 500 })

    // profiles도 동기화 (전화번호/이름 변경 시)
    const { data: app } = await supabaseAdmin
      .from('member_applications')
      .select('phone')
      .eq('id', id)
      .single()

    if (app) {
      await supabaseAdmin
        .from('profiles')
        .update({ name: name.trim(), phone: cleanPhone })
        .eq('phone', app.phone)
        .eq('role', 'member')
    }

    return NextResponse.json({ ok: true })
  }

  // ── 기존: 승인 / 거절 (레거시 — 즉시가입 방식 후 사용 안 함) ─────────
  if (action === 'approve') {
    const temp_pin = Math.floor(100000 + Math.random() * 900000).toString()
    const bcrypt = await import('bcryptjs')
    const pin_hash = await bcrypt.hash(temp_pin, 10)

    const { data: app, error: appError } = await supabaseAdmin
      .from('member_applications')
      .select('*')
      .eq('id', id)
      .single()

    if (appError || !app) return NextResponse.json({ error: '신청 정보 없음' }, { status: 404 })

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        name:            app.name,
        phone:           app.phone,
        role:            'member',
        pin_hash,
        pin_must_change: true,
        is_active:       true,
        is_owner:        false,
      })

    if (profileError) {
      if (profileError.code === '23505') {
        return NextResponse.json({ error: '이미 등록된 전화번호입니다' }, { status: 409 })
      }
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    await supabaseAdmin
      .from('member_applications')
      .update({ status: 'approved', reviewed_by: session.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ ok: true, temp_pin })

  } else if (action === 'reject') {
    const { error } = await supabaseAdmin
      .from('member_applications')
      .update({ status: 'rejected', reviewed_by: session.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })

  } else {
    return NextResponse.json({ error: '잘못된 action' }, { status: 400 })
  }
}

// ── 가입서 삭제 ──────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await params
  const { error } = await supabaseAdmin
    .from('member_applications')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}