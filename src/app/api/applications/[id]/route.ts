// src/app/api/applications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { action } = await req.json()
  const { id } = params

  if (action === 'approve') {
    // 임시 PIN 생성 (6자리 숫자)
    const temp_pin = Math.floor(100000 + Math.random() * 900000).toString()
    const bcrypt = await import('bcryptjs')
    const pin_hash = await bcrypt.hash(temp_pin, 10)

    // 신청 정보 가져오기
    const { data: app, error: appError } = await supabaseAdmin
      .from('member_applications')
      .select('*')
      .eq('id', id)
      .single()

    if (appError || !app) return NextResponse.json({ error: '신청 정보 없음' }, { status: 404 })

    // profiles 에 회원 생성
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        name: app.name,
        phone: app.phone,
        role: 'member',
        pin_hash,
        pin_must_change: true,
        is_active: true,
        is_owner: false,
      })

    if (profileError) {
      if (profileError.code === '23505') {
        return NextResponse.json({ error: '이미 등록된 전화번호입니다' }, { status: 409 })
      }
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // 신청 상태 승인으로 변경
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