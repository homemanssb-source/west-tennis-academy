import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { userId, pin } = await request.json()

    if (!userId || !pin || pin.length !== 6) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    const admin = await createAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({ pin_code: pin })
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: 'PIN 저장에 실패했습니다.' }, { status: 500 })
    }

    // PIN 설정 후 바로 세션 발급
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, name')
      .eq('id', userId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: '프로필을 찾을 수 없습니다.' }, { status: 404 })
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
    console.error('PIN 설정 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
