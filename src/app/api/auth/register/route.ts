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
    const body = await request.json()
    const { phone, name, gender, birth_date, tennis_career, coach_id,
            lesson_type, preferred_days, preferred_times, notes, auto_rollover } = body

    if (!phone || !name) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 })
    }

    const normalized = normalizePhone(phone)
    const admin = await createAdminClient()

    // 중복 체크
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('phone', normalized)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '이미 등록된 전화번호입니다.' }, { status: 409 })
    }

    // auth.users에 더미 유저 생성 (profiles FK 때문에 필요)
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      phone: normalized,
      phone_confirm: true,
      user_metadata: { name },
    })

    if (authError || !authUser.user) {
      return NextResponse.json({ error: '계정 생성에 실패했습니다.' }, { status: 500 })
    }

    const userId = authUser.user.id

    // profiles 테이블에 저장
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      phone: normalized,
      name, gender, birth_date: birth_date || null,
      tennis_career: tennis_career || null,
      coach_id: coach_id || null,
      lesson_type, preferred_days, preferred_times,
      notes: notes || null,
      auto_rollover,
      role: 'member',
      is_active: true,
    })

    if (profileError) {
      // 롤백
      await admin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: '프로필 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId })
  } catch (e) {
    console.error('register error:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
