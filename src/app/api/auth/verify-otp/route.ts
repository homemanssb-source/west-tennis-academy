import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { phone, token } = await request.json()

    if (!phone || !token || token.length !== 6) {
      return NextResponse.json({ error: '전화번호 또는 OTP가 올바르지 않습니다.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    })

    if (error || !data.user) {
      return NextResponse.json({ error: '인증번호가 올바르지 않거나 만료되었습니다.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, name')
      .eq('id', data.user.id)
      .single()

    return NextResponse.json({
      success: true,
      isNewUser: !profile,
      role: profile?.role ?? null,
      name: profile?.name ?? null,
    })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}