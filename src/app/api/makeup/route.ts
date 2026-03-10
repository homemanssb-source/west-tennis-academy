import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// 코치 휴무 충돌 체크 헬퍼
async function checkCoachBlock(coachId: string, datetimeStr: string, durationMinutes: number): Promise<boolean> {
  const dt    = new Date(datetimeStr)
  const date  = dt.toISOString().split('T')[0]
  const hhmm  = dt.toTimeString().slice(0, 5) // "HH:MM"
  const dayOfWeek = dt.getDay() // 0=일 ~ 6=토

  const endDt   = new Date(dt.getTime() + durationMinutes * 60 * 1000)
  const endHhmm = endDt.toTimeString().slice(0, 5)

  const { data: blocks } = await supabaseAdmin
    .from('coach_blocks')
    .select('*')
    .eq('coach_id', coachId)
    .or(`block_date.eq.${date},and(repeat_weekly.eq.true,day_of_week.eq.${dayOfWeek})`)

  if (!blocks || blocks.length === 0) return false

  for (const b of blocks) {
    // 종일 휴무
    if (!b.block_start && !b.block_end) return true
    // 시간대 겹침
    const bStart = b.block_start ?? '00:00'
    const bEnd   = b.block_end   ?? '23:59'
    if (hhmm < bEnd && endHhmm > bStart) return true
  }
  return false
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const memberId = req.nextUrl.searchParams.get('member_id') ?? session.id

  const { data, error } = await supabaseAdmin
    .from('makeup_bookings')
    .select(`
      id, status, created_at,
      original_slot:original_slot_id (
        id, scheduled_at, duration_minutes,
        lesson_plan:lesson_plan_id ( lesson_type, coach:coach_id(name) )
      ),
      makeup_slot:makeup_slot_id (
        id, scheduled_at, duration_minutes, status
      )
    `)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { original_slot_id, makeup_datetime } = await req.json()
  if (!original_slot_id || !makeup_datetime) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  // 원래 슬롯 조회
  const { data: origSlot } = await supabaseAdmin
    .from('lesson_slots')
    .select('id, lesson_plan_id, duration_minutes, status, scheduled_at')
    .eq('id', original_slot_id)
    .single()

  if (!origSlot) return NextResponse.json({ error: '슬롯 없음' }, { status: 404 })

  // ✅ FIX #4: 소유권 검증 - 회원 역할이면 본인 수업인지 확인
  if (session.role === 'member') {
    const { data: plan } = await supabaseAdmin
      .from('lesson_plans')
      .select('member_id')
      .eq('id', origSlot.lesson_plan_id)
      .single()
    if (!plan || plan.member_id !== session.id) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }
  }

  // ✅ FIX #12: 중복 보강 방지 - 이미 보강 등록된 슬롯인지 확인
  const { data: existing } = await supabaseAdmin
    .from('makeup_bookings')
    .select('id')
    .eq('original_slot_id', original_slot_id)
    .not('status', 'eq', 'cancelled')
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: '이미 보강이 등록된 수업입니다' }, { status: 409 })
  }

  // lesson_plan에서 coach_id, member_id 조회
  const { data: planData } = await supabaseAdmin
    .from('lesson_plans')
    .select('coach_id, member_id, lesson_type')
    .eq('id', origSlot.lesson_plan_id)
    .single()

  if (!planData) return NextResponse.json({ error: '플랜 없음' }, { status: 404 })

  // ✅ FIX #6/#8: 보강 시 코치 휴무 체크
  if (planData.coach_id) {
    const hasConflict = await checkCoachBlock(planData.coach_id, makeup_datetime, origSlot.duration_minutes)
    if (hasConflict) {
      return NextResponse.json({ error: '해당 시간에 코치 휴무가 등록되어 있습니다' }, { status: 409 })
    }
  }

  // 보강 슬롯 생성
  const { data: makeupSlot, error: slotErr } = await supabaseAdmin
    .from('lesson_slots')
    .insert({
      lesson_plan_id:   origSlot.lesson_plan_id,
      scheduled_at:     makeup_datetime,
      duration_minutes: origSlot.duration_minutes,
      status:           'scheduled',
      is_makeup:        true,
      slot_type:        'lesson',
    })
    .select('id')
    .single()

  if (slotErr) return NextResponse.json({ error: slotErr.message }, { status: 500 })

  // 원래 슬롯 absent 처리
  await supabaseAdmin.from('lesson_slots').update({ status: 'absent' }).eq('id', original_slot_id)

  // member_id 결정 (운영자가 등록하는 경우 planData에서 가져옴)
  const memberId = session.role === 'member' ? session.id : planData.member_id

  // 보강 예약 생성
  const { data: booking, error: bookErr } = await supabaseAdmin
    .from('makeup_bookings')
    .insert({
      original_slot_id,
      makeup_slot_id: makeupSlot.id,
      member_id: memberId,
      status: 'confirmed',
    })
    .select()
    .single()

  if (bookErr) return NextResponse.json({ error: bookErr.message }, { status: 500 })

  // ✅ FIX #10: 보강 확정 알림 — 회원 + 코치에게 발송
  const makeupDt  = new Date(makeup_datetime)
  const timeStr   = makeupDt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
    + ' ' + makeupDt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  const lessonType = planData.lesson_type ?? '보강 수업'

  const notifs = []
  if (memberId) {
    notifs.push({
      profile_id: memberId,
      title: '🎾 보강 수업 확정',
      body: `${timeStr} ${lessonType} 보강 수업이 확정되었습니다.`,
      type: 'info',
      link: '/member/schedule',
    })
  }
  if (planData.coach_id) {
    notifs.push({
      profile_id: planData.coach_id,
      title: '📅 보강 수업 등록',
      body: `${timeStr} ${lessonType} 보강 수업이 등록되었습니다.`,
      type: 'info',
      link: '/coach/schedule',
    })
  }
  if (notifs.length > 0) await supabaseAdmin.from('notifications').insert(notifs)

  return NextResponse.json(booking)
}