import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { makeSessionCookie, SESSION_COOKIE } from '@/lib/session'

export async function POST(req: NextRequest) {
  // ✅ FIX #3: SETUP_SECRET 환경변수로 인증
  const secret = req.headers.get('x-setup-secret')
  if (!secret || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  try {
    const { name, phone, pin } = await req.json()

    if (!name || !phone || !pin) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN은 숫자 6자리여야 합니다' }, { status: 400 })
    }

    const pin_hash = await bcrypt.hash(pin, 10)

    // ✅ FIX #3: 레이스컨디션 방지 → INSERT 후 unique constraint로 중복 차단
    // (profiles 테이블의 role='owner'에 unique constraint 또는 is_owner=true 조건 활용)
    // INSERT 시도 전 count 체크는 race condition 유발 가능하므로 DB constraint에 위임
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        name,
        phone: phone.replace(/-/g, ''),
        role: 'owner',
        pin_hash,
        pin_must_change: false,
        is_owner: true,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 등록된 운영자 또는 전화번호입니다' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const sessionValue = makeSessionCookie({
      id:       data.id,
      name:     data.name,
      role:     'owner',
      is_owner: true,
    })

    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, sessionValue, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 24 * 7,
    })
    return res

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}