import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { makeSessionCookie, SESSION_COOKIE } from '@/lib/session'
import { Role } from '@/lib/types'

const ROLE_HOME: Record<Role, string> = {
  owner:   '/owner',
  admin:   '/admin',
  coach:   '/coach',
  payment: '/payment',
  member:  '/member',
}

export async function POST(req: NextRequest) {
  try {
    const { phone, pin, role } = await req.json()
    console.log('=== 로그인 시도 ===', { phone, role, pinLen: pin?.length })

    const cleanPhone = phone.replace(/-/g, '')

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, role, pin_hash, pin_must_change, is_owner, is_active')
      .eq('phone', cleanPhone)
      .eq('role', role)
      .single()

    console.log('DB 조회 결과:', { user: user?.name, role: user?.role, error })

    if (error || !user) {
      return NextResponse.json({ error: '전화번호 또는 PIN이 올바르지 않습니다' }, { status: 401 })
    }

    if (!user.is_active) {
      return NextResponse.json({ error: '비활성화된 계정입니다' }, { status: 403 })
    }

    const ok = await bcrypt.compare(pin, user.pin_hash)
    console.log('PIN 검증:', ok)

    if (!ok) {
      return NextResponse.json({ error: '전화번호 또는 PIN이 올바르지 않습니다' }, { status: 401 })
    }

    const sessionValue = makeSessionCookie({
      id:       user.id,
      name:     user.name,
      role:     user.role as Role,
      is_owner: user.is_owner,
    })

    const redirectTo = user.pin_must_change
      ? `/${role}/pin-change`
      : ROLE_HOME[user.role as Role]

    const res = NextResponse.json({ ok: true, pin_must_change: user.pin_must_change, redirect: redirectTo })
    res.cookies.set(SESSION_COOKIE, sessionValue, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 24 * 7,
    })
    return res
  } catch (e) {
    console.error('/api/auth/login error:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
