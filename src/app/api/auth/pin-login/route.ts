import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('010') && digits.length === 11) return '+82' + digits.slice(1)
  return phone
}

export async function POST(request: NextRequest) {
  try {
    const { phone, pin } = await request.json()
    if (!phone || !pin) {
      return NextResponse.json({ error: '전화번호와 PIN을 입력해 주세요.' }, { status: 400 })
    }

    const normalized = normalizePhone(phone)
    const admin = await createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('id, name, role, pin_code, is_active')
      .eq('phone', normalized)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: '등록되지 않은 전화번호입니다.' }, { status: 404 })
    }
    if (!profile.is_active) {
      return NextResponse.json({ error: '비활성화된 계정입니다.' }, { status: 403 })
    }
    if (profile.pin_code !== pin) {
      return NextResponse.json({ error: 'PIN이 올바르지 않습니다.' }, { status: 401 })
    }

    const cookieStore = await cookies()
    const sessionValue = Buffer.from(JSON.stringify({
      userId: profile.id,
      role: profile.role,
      name: profile.name,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })).toString('base64')

    cookieStore.set('wta_session', sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({ success: true, role: profile.role })
  } catch (e) {
    console.error('PIN 로그인 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}