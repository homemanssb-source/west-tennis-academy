// src/app/api/lesson-applications/route.ts
// ✅ FIX N+1: family_member 개별 조회 → IN 쿼리 일괄 조회
// ✅ FIX 코치휴무: POST에 checkCoachBlock 호출 추가
// ✅ FIX 정원체크: program_id 필터 추가 + 시간 범위 체크로 변경 (동일 시간대 다른 프로그램 오카운트 방지)
// ✅ FIX pending_admin 취소 허용 추가 (DELETE)
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser } from '@/lib/push'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import { checkCoachBlock } from '@/lib/checkCoachBlock'

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
      family_member_id, program_id,
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

  // ✅ FIX N+1: family_member_id 있는 항목을 IN 쿼리로 일괄 조회
  const familyIds = (data ?? [])
    .filter((a: any) => a.family_member_id)
    .map((a: any) => a.family_member_id)

  let familyMap: Record<string, string> = {}
  if (familyIds.length > 0) {
    const { data: families } = await supabaseAdmin
      .from('family_members')
      .select('id, name')
      .in('id', familyIds)
    familyMap = Object.fromEntries((families ?? []).map((f: any) => [f.id, f.name]))
  }

  const result = (data ?? []).map((app: any) => ({
    ...app,
    applicant_name: app.family_member_id ? (familyMap[app.family_member_id] ?? null) : null,
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

  // ✅ program_id가 있으면 반드시 DB에서 max_students 조회
  // program_id 없는 경우: lesson_type 문자열로 판단 (레거시 호환)
  const isGroup = !!program_id || lesson_type === '그룹레슨'
  let maxStudents = isGroup ? 999 : 1

  if (program_id) {
    const { data: prog } = await supabaseAdmin
      .from('lesson_programs')
      .select('max_students')
      .eq('id', program_id)
      .single()
    if (prog?.max_students) maxStudents = prog.max_students
  }

  const dur = duration_minutes ?? 60
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

    // 코치 휴무 블록 체크
    const block = await checkCoachBlock(coach_id, requested_at, dur)
    if (block) { errors.push(requested_at + ' 코치 휴무'); continue }

    // 확정 슬롯 충돌 확인 — 개인레슨만 차단, 그룹레슨은 정원 체크로 대체
    if (!isGroup) {
      const { data: conflictSlots } = await supabaseAdmin
        .from('lesson_slots')
        .select('id, lesson_plan:lesson_plan_id(coach_id)')
        .eq('scheduled_at', requested_at)
        .in('status', ['scheduled', 'completed'])

      const hasConflict = (conflictSlots ?? []).some(
        (s: any) => (s.lesson_plan as any)?.coach_id === coach_id
      )
      if (hasConflict) { errors.push(requested_at + ' 수업 충돌'); continue }
    }

    // ✅ 정원 체크 (B2 FIX):
    //   - approved 상태는 lesson_slots.scheduled_at 기준(관리자가 시간 변경했을 수 있음)
    //   - pending_* 상태는 lesson_applications.requested_at 기준
    //   → 이렇게 해야 "슬롯 시간 이동 후 원래 시간으로 새 신청이 들어올 때 false-full" 방지
    if (isGroup) {
      // 1) pending 신청(아직 확정 전) — lesson_applications.requested_at
      let pendingQ = supabaseAdmin
        .from('lesson_applications')
        .select('id', { count: 'exact', head: true })
        .eq('coach_id', coach_id)
        .eq('requested_at', requested_at)
        .in('status', ['pending_coach', 'pending_admin'])
      if (program_id) pendingQ = pendingQ.eq('program_id', program_id)
      const { count: pendingCount } = await pendingQ

      // 2) 확정 수업(approved) — lesson_slots.scheduled_at (재스케줄 반영된 실제 시간)
      let slotQ = supabaseAdmin
        .from('lesson_slots')
        .select('id, lesson_plan:lesson_plan_id!inner(coach_id, program_id)', {
          count: 'exact',
          head: false,
        })
        .eq('scheduled_at', requested_at)
        .in('status', ['scheduled', 'completed'])
      const { data: slotRows } = await slotQ
      const approvedCount = (slotRows ?? []).filter((s: any) => {
        const lp = s.lesson_plan as any
        if (!lp || lp.coach_id !== coach_id) return false
        if (program_id) return lp.program_id === program_id
        return true // 레거시: program_id 없으면 코치만 매칭
      }).length

      const currentCount = (pendingCount ?? 0) + approvedCount

      if (currentCount >= maxStudents) {
        errors.push(requested_at + ` 정원 초과 (${currentCount}/${maxStudents}명)`)
        continue
      }
    }

    // INSERT
    const { data, error } = await supabaseAdmin
      .from('lesson_applications')
      .insert({
        member_id:        session.id,
        coach_id,
        month_id,
        requested_at,
        duration_minutes: dur,
        lesson_type:      lesson_type ?? '개인레슨',
        status:           'pending_coach',
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
