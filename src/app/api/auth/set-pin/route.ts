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

    if (error) throw error

    // 세션 쿠키 발급
    const { data: profile } = await admin
      .from('profiles')
      .select('id, name, role')
      .eq('id', userId)
      .single()

    if (!profile) throw new Error('프로필을 찾을 수 없습니다.')

    const session = {
      userId: profile.id,
      role: profile.role,
      name: profile.name,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }
    const encoded = Buffer.from(JSON.stringify(session)).toString('base64')

    const cookieStore = await cookies()
    cookieStore.set('wta_session', encoded, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({ success: true, role: profile.role })
  } catch (e: any) {
    console.error('set-pin error:', e)
    return NextResponse.json({ error: e.message ?? 'PIN 설정에 실패했습니다.' }, { status: 500 })
  }
}