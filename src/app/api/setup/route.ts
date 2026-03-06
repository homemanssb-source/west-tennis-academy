import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { makeSessionCookie, SESSION_COOKIE } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const { name, phone, pin } = await req.json()
    console.log('=== /api/setup 시작 ===')
    console.log('입력값:', { name, phone, pin: pin?.length })

    if (!name || !phone || !pin) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN은 숫자 6자리여야 합니다' }, { status: 400 })
    }

    // count 확인
    console.log('count 확인 중...')
    const { count, error: countError } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    console.log('count 결과:', { count, countError })

    if (countError) {
      return NextResponse.json({ error: 'DB 조회 실패: ' + countError.message }, { status: 500 })
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: '이미 등록된 운영자가 있습니다' }, { status: 403 })
    }

    // PIN 해시
    console.log('bcrypt 해시 중...')
    const pin_hash = await bcrypt.hash(pin, 10)
    console.log('해시 완료')

    // INSERT
    console.log('INSERT 시도 중...')
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

    console.log('INSERT 결과:', { data: data?.id, error })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 등록된 전화번호입니다' }, { status: 409 })
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
    console.log('=== /api/setup 완료 ===')
    return res

  } catch (e) {
    console.error('/api/setup 예외:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
