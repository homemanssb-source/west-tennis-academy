import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// GET - 신청 목록 조회
// owner/admin: 전체 | coach: 본인 관련 | member: 본인 신청
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
      member:profiles!lesson_applications_member_id_fkey(id, name, phone),
      coach:profiles!lesson_applications_coach_id_fkey(id, name),
      month:months(id, year, month)
    `)
    .order('created_at', { ascending: false })

  if (session.role === 'member') {
    query = query.eq('member_id', session.id)
  } else if (session.role === 'coach') {
    query = query.eq('coach_id', session.id)
  }

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST - 회원이 수업 신청
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '회원만 신청 가능합니다' }, { status: 403 })
  }

  const { coach_id, month_id, requested_at, duration_minutes, lesson_type } = await req.json()
  if (!coach_id || !month_id || !requested_at) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  // 중복 신청 확인 (같은 시간대에 이미 신청한 경우)
  const { data: existing } = await supabaseAdmin
    .from('lesson_applications')
    .select('id')
    .eq('member_id', session.id)
    .eq('requested_at', requested_at)
    .in('status', ['pending_coach', 'pending_admin', 'approved'])
    .single()

  if (existing) {
    return NextResponse.json({ error: '해당 시간에 이미 신청이 있습니다' }, { status: 409 })
  }

  // 해당 시간에 이미 확정된 수업이 있는지 확인
  const { data: slotConflict } = await supabaseAdmin
    .from('lesson_slots')
    .select('id')
    .eq('scheduled_at', requested_at)
    .in('status', ['scheduled', 'completed'])
    .single()

  if (slotConflict) {
    return NextResponse.json({ error: '해당 시간은 이미 수업이 있습니다' }, { status: 409 })
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
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 코치에게 알림
  await supabaseAdmin.from('notifications').insert({
    profile_id: coach_id,
    title: '새 수업 신청',
    body: `${session.name}님이 수업을 신청했습니다. 확인해주세요.`,
    type: 'info',
    link: '/coach/applications',
  })

  return NextResponse.json(data)
}
