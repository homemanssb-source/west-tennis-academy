import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function parseSession(raw: string | undefined) {
  if (!raw) return null
  try {
    const s = JSON.parse(Buffer.from(raw, 'base64').toString())
    if (s.exp < Date.now()) return null
    return s
  } catch { return null }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('010') && digits.length === 11) return '+82' + digits.slice(1)
  return phone
}

// 가족 목록 조회
export async function GET() {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const admin = await createAdminClient()

  // 본인 + 자녀 목록
  const { data: members } = await admin
    .from('profiles')
    .select('id, name, display_name, role, coach_id, lesson_type, is_primary, parent_id, coach:coach_id(name)')
    .or(`id.eq.${session.userId},parent_id.eq.${session.userId}`)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })

  return NextResponse.json({ members: members ?? [] })
}

// 가족 구성원 추가
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      name, display_name, gender, birth_date, tennis_career,
      coach_id, lesson_type, preferred_days, preferred_times, notes, auto_rollover
    } = body

    if (!name || !coach_id) {
      return NextResponse.json({ error: '성명과 담당 코치는 필수입니다.' }, { status: 400 })
    }

    const admin = await createAdminClient()

    // 부모 프로필 조회 (전화번호 가져오기)
    const { data: parent } = await admin
      .from('profiles')
      .select('phone')
      .eq('id', session.userId)
      .single()

    // auth.users에 더미 유저 생성
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      phone: `${parent?.phone}_child_${Date.now()}`, // 더미 phone
      phone_confirm: true,
      user_metadata: { name, parent_id: session.userId },
    })

    if (authError || !authUser.user) {
      return NextResponse.json({ error: '계정 생성에 실패했습니다.' }, { status: 500 })
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id: authUser.user.id,
      phone: `family_${session.userId}_${Date.now()}`, // 가족은 전화번호 없음
      name,
      display_name: display_name || name,
      gender: gender || null,
      birth_date: birth_date || null,
      tennis_career: tennis_career || null,
      coach_id,
      lesson_type: lesson_type || 'individual',
      preferred_days: preferred_days || [],
      preferred_times: preferred_times || [],
      notes: notes || null,
      auto_rollover: auto_rollover ?? true,
      role: 'member',
      is_active: true,
      is_primary: false,
      parent_id: session.userId,
    })

    if (profileError) {
      await admin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: '프로필 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, memberId: authUser.user.id })
  } catch (e) {
    console.error('가족 추가 오류:', e)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
