import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

// GET - 코치 목록 (모든 로그인 사용자 접근 가능)
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  let query = supabaseAdmin
    .from('profiles')
    .select('id, name, phone, is_active, created_at')
    .eq('role', 'coach')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  // ✅ 회원에게는 숨김 코치 제외
  if (session.role === 'member') {
    query = query.eq('hide_from_member', false)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - 코치 등록 (owner/admin 전용)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  try {
    const { name, phone } = await req.json()
    if (!name || !phone) return NextResponse.json({ error: '이름과 전화번호는 필수입니다' }, { status: 400 })

    const tempPin = Math.floor(100000 + Math.random() * 900000).toString()
    const pin_hash = await bcrypt.hash(tempPin, 10)

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({ name, phone: phone.replace(/-/g, ''), role: 'coach', pin_hash, pin_must_change: true, is_active: true })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: '이미 등록된 전화번호입니다' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ...data, temp_pin: tempPin }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}