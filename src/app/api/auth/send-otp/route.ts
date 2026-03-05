import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('010') && digits.length === 11) return '+82' + digits.slice(1)
  if (digits.startsWith('82') && digits.length === 12) return '+' + digits
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()
    const normalized = normalizePhone(phone)
    if (!normalized) {
      return NextResponse.json({ error: '올바른 전화번호 형식이 아닙니다.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized })
    if (error) {
      return NextResponse.json({ error: 'OTP 발송에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, phone: normalized })
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}