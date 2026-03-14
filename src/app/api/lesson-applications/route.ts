import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// GET - 신청 목록 조회
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('lesson_applications')
    .select(`
      id, requested_at, duration_minutes, lesson_type,
      status, coach_note, admin_note, created_at,
      family_member_id,
      member:profiles!lesson_applications_member_id_fkey(id, name, phone),
      coach:profiles!lesson_applications_coach_id_fkey(id, name),
      month:months(id, year, month)
    `)
    .order('created_at', { ascending: false })

  if (session.role === 'member') query = query.eq('member_id', session.id)
  else if (session.role === 'coach') query = query.eq('coach_id', session.id)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 가족 이름 첨부
  const result = await Promise.all((data ?? []).map(async (app: any) => {
    if (app.family_member_id) {
      const { data: fm } = await supabaseAdmin
        .from('family_members')
        .select('name')
        .eq('id', app.family_member_id)
        .single()
      return { ...app, applicant_name: fm?.name ?? null }
    }
    return app
  }))

  return NextResponse.json(result)
}

// POST - 수업 신청 (여러 슬롯 한번에, 가족 신청 지원)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '회원만 신청 가능합니다' }, { status: 403 })
  }

  const { coach_id, month_id, slots, duration_minutes, lesson_type, family_member_id, program_id } = await req.json()

  if (!coach_id || !month_id || !slots || !Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  // 가족 신청 시 해당 가족이 본인 계정 소유인지 확인
  if (family_member_id) {
    const { data: fm } = await supabaseAdmin
      .from('family_members')
      .select('id')
      .eq('id', family_member_id)
      .eq('account_id', session.id)
      .single()
    if (!fm) return NextResponse.json({ error: '가족 정보 오류' }, { status: 403 })
  }

  const created = []
  const errors  = []

  for (const requested_at of slots) {
    // 중복 확인
    const { data: existing } = await supabaseAdmin
      .from('lesson_applications')
      .select('id')
      .eq('member_id', session.id)
      .eq('requested_at', requested_at)
      .in('status', ['pending_coach', 'pending_admin', 'approved'])
      .maybeSingle()

    if (existing) { errors.push(`${requested_at} 중복`); continue }

    // 슬롯 충돌 확인 (같은 코치 같은 시간)
    const { data: conflict } = await supabaseAdmin
      .from('lesson_slots')
      .select('id')
      .eq('scheduled_at', requested_at)
      .in('status', ['scheduled', 'completed'])
      .maybeSingle()
    if (conflict) { errors.push(requested_at + ' 수업 충돌'); continue }

    // 다른 회원 신청 중복 체크 - 프로그램 max_students 기반
    const { data: otherApps } = await supabaseAdmin
      .from('lesson_applications')
      .select('id')
      .eq('coach_id', coach_id)
      .eq('requested_at', requested_at)
      .in('status', ['pending_coach', 'pending_admin', 'approved'])

    const currentCount = (otherApps ?? []).length

    // 프로그램의 max_students 확인 (없으면 1명 = 개인레슨)
    let maxStudents = 1
    if (program_id) {
      const { data: prog } = await supabaseAdmin
        .from('lesson_programs')
        .select('max_students')
        .eq('id', program_id)
        .single()
      if (prog?.max_students) maxStudents = prog.max_students
    }

    if (currentCount >= maxStudents) {
      errors.push(requested_at + ` 정원 초과 (${currentCount}/${maxStudents}명)`)
      continue
    }

    const { data, error } = await supabaseAdmin
      .from('lesson_applications')
      .insert({
        member_id: session.id,
        coach_id,
        month_id,
        requested_at,
        duration_minutes: duration_minutes ?? 60,
        lesson_type: lesson_type ?? '개인레슨',
        status: 'pending_coach',
        family_member_id: family_member_id ?? null,
        ...(program_id ? { program_id } : {}),
      })
      .select()
      .single()

    if (error) {
      console.error('INSERT ERROR:', JSON.stringify(error))
      errors.push(error.message)
    }
    else created.push(data)
  }

  if (created.length === 0) {
    return NextResponse.json({ error: `신청 실패: ${errors.join(', ')}` }, { status: 409 })
  }

  // 코치에게 알림 (한번만)
  await supabaseAdmin.from('notifications').insert({
    profile_id: coach_id,
    title: '새 수업 신청',
    body: `${session.name}님이 ${created.length}회 수업을 신청했습니다. 확인해주세요.`,
    type: 'info',
    link: '/coach/applications',
  })

  // 핸드폰 푸시 알림
  await sendPushToUser(coach_id, '🎾 새 수업 신청', session.name + '님이 ' + created.length + '개 수업을 신청했습니다.', '/coach/applications')

  return NextResponse.json({ created: created.length, errors })
}