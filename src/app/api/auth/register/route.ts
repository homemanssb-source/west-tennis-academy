import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('010') && digits.length === 11) return '+82' + digits.slice(1)
  return phone
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, name, gender, birth_date, tennis_career, coach_id,
            lesson_type, preferred_days, preferred_times, notes, auto_rollover } = body

    if (!phone || !name) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 })
    }

    const normalized = normalizePhone(phone)
    const admin = await createAdminClient()

    // 기존 회원 확인
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('phone', normalized)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '이미 가입된 전화번호입니다.' }, { status: 409 })
    }

    // auth.users 더미 생성
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      phone: normalized,
      phone_confirm: true,
    })

    if (authError) throw authError

    // profiles 생성
    const { error: profileError } = await admin.from('profiles').insert({
      id: authUser.user.id,
      phone: normalized,
      name,
      gender: gender || null,
      birth_date: birth_date || null,
      tennis_career: tennis_career || null,
      coach_id: coach_id || null,
      lesson_type: lesson_type || 'individual',
      preferred_days: preferred_days || [],
      preferred_times: preferred_times || [],
      notes: notes || null,
      auto_rollover: auto_rollover ?? true,
      role: 'member',
      is_active: true,
      is_primary: true,
    })

    if (profileError) throw profileError

    return NextResponse.json({ success: true, userId: authUser.user.id })
  } catch (e: any) {
    console.error('register error:', e)
    return NextResponse.json({ error: e.message ?? '등록에 실패했습니다.' }, { status: 500 })
  }
}