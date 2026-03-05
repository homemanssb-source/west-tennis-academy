import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('010') && digits.length === 11) return '+82' + digits.slice(1)
  return phone
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()
    const normalized = normalizePhone(phone)

    const admin = await createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('id, name, pin_code, is_active')
      .eq('phone', normalized)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ isNewUser: true })
    }

    if (!profile.is_active) {
      return NextResponse.json({ error: '비활성화된 계정입니다.' }, { status: 403 })
    }

    return NextResponse.json({
      isNewUser: false,
      hasPin: !!profile.pin_code,
      name: profile.name,
    })
  } catch (e) {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
