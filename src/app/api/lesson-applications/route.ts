// src/app/api/lesson-applications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

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

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '회원만 신청 가능합니다' }, { status: 403 })
  }

  const { coach_id, month_id, slots, duration_minutes, lesson_type, family_member_id, program_id } = await req.json()

  if (!coach_id || !month_id || !slots || !Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  if (family_member_id) {
    const { data: fm } = await supabaseAdmin
      .from('family_members')
      .select('id')
      .eq('id', family_member_id)
      .eq('account_id', session.id)
      .single()
    if (!fm) return NextResponse.json({ error: '가족 정보 오류' }, { status: 403 })
  }

  // ✅ 수정: max_students를 루프 밖에서 한 번만 조회 (N+1 제거)
  let maxStudents = 1
  if (program_id) {
    const { data: prog } = await supabaseAdmin
      .from('lesson_programs')
      .select('max_students')
      .eq('id', program_id)
      .single()
    if (prog?.max_students) maxStudents = prog.max_students
  }

  const created = []
  const errors  = []

  for (const requested_at of slots) {
    // 본인 중복 확인
    const { data: existing } = await supabaseAdmin
      .from('lesson_applications')
      .select('id')
      .eq('member_id', session.id)
      .eq('requested_at', requested_at)
      .in('status', ['pending_coach', 'pending_admin', 'approved'])
      .maybeSingle()

    if (existing) { errors.push(`${requested_at} 중복`); continue }

    // 확정 슬롯 충돌 확인
    const { data: conflict } = await supabaseAdmin
      .from('lesson_slots')
      .select('id')
      .eq('scheduled_at', requested_at)
      .eq('lesson_plan.coach_id', coach_id) // ✅ 수정: 코치 기준으로 충돌 체크
      .in('status', ['scheduled', 'completed'])
      .maybeSingle()
    if (conflict) { errors.push(requested_at + ' 수업 충돌'); continue }

    // 정원 체크 (다른 회원 신청 수)
    const { data: otherApps } = await supabaseAdmin
      .from('lesson_applications')
      .select('id')
      .eq('coach_id', coach_id)
      .eq('requested_at', requested_at)
      .in('status', ['pending_coach', 'pending_admin', 'approved'])

    const currentCount = (otherApps ?? []).length

    if (currentCount >= maxStudents) {
      errors.push(requested_at + ` 정원 초과 (${currentCount}/${maxStudents}명)`)
      continue
    }

    // ✅ 수정: INSERT 실패 시 duplicate key(23505)로 레이스컨디션 방어
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
      if (error.code === '23505') {
        errors.push(requested_at + ' 동시 신청 중복')
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.error('INSERT ERROR:', JSON.stringify(error))
        }
        errors.push(error.message)
      }
    } else {
      created.push(data)
    }
  }

  if (created.length === 0) {
    return NextResponse.json({ error: `신청 실패: ${errors.join(', ')}` }, { status: 409 })
  }

  // 코치 알림
  const { error: notifErr } = await supabaseAdmin.from('notifications').insert({
    profile_id: coach_id,
    title: '새 수업 신청',
    body: `${session.name}님이 ${created.length}회 수업을 신청했습니다. 확인해주세요.`,
    type: 'info',
    link: '/coach/applications',
  })
  if (notifErr && process.env.NODE_ENV !== 'production') {
    console.error('알림 발송 실패:', notifErr.message)
  }

  await sendPushToUser(
    coach_id,
    '🎾 새 수업 신청',
    session.name + '님이 ' + created.length + '개 수업을 신청했습니다.',
    '/coach/applications'
  )

  return NextResponse.json({ created: created.length, errors })
}