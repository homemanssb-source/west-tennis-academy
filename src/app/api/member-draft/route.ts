// src/app/api/member-draft/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// GET /api/member-draft?month_id=xxx
// 회원 본인의 다음달 draft 슬롯 조회 (draft_open=true인 달만)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const monthId = req.nextUrl.searchParams.get('month_id')
  if (!monthId) return NextResponse.json({ error: 'month_id 필요' }, { status: 400 })

  // draft_open 여부 확인
  const { data: month } = await supabaseAdmin
    .from('months')
    .select('id, year, month, draft_open')
    .eq('id', monthId)
    .single()

  if (!month) return NextResponse.json({ error: '해당 월 없음' }, { status: 404 })
  if (!month.draft_open) return NextResponse.json({ draftOpen: false, slots: [] })

  // 본인 플랜 조회
  const { data: plans } = await supabaseAdmin
    .from('lesson_plans')
    .select('id, lesson_type, unit_minutes, coach:coach_id(id, name)')
    .eq('member_id', session.id)
    .eq('month_id', monthId)

  if (!plans || plans.length === 0) {
    return NextResponse.json({ draftOpen: true, slots: [] })
  }

  const planIds = plans.map((p: any) => p.id)

  // draft 슬롯 조회
  const { data: slots, error } = await supabaseAdmin
    .from('lesson_slots')
    .select('id, scheduled_at, duration_minutes, status, has_conflict, lesson_plan_id')
    .in('lesson_plan_id', planIds)
    .eq('status', 'draft')
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 기존 수정 요청 조회 (이 달에 대한 pending 요청)
  const { data: requests } = await supabaseAdmin
    .from('lesson_applications')
    .select('id, requested_at, request_type, draft_slot_id, status, coach_note, admin_note')
    .eq('member_id', session.id)
    .eq('month_id', monthId)
    .in('request_type', ['change', 'exclude', 'add'])
    .in('status', ['pending_coach', 'pending_admin', 'approved', 'rejected'])

  // 슬롯에 플랜 정보 합치기
  const planMap = new Map(plans.map((p: any) => [p.id, p]))
  const slotsWithPlan = (slots ?? []).map((s: any) => ({
    ...s,
    lesson_type:    planMap.get(s.lesson_plan_id)?.lesson_type ?? '',
    coach_name:     planMap.get(s.lesson_plan_id)?.coach?.name ?? '',
    // 이 슬롯에 대한 기존 요청 여부
    existing_request: (requests ?? []).find((r: any) => r.draft_slot_id === s.id) ?? null,
  }))

  return NextResponse.json({
    draftOpen: true,
    month: { year: month.year, month: month.month },
    slots: slotsWithPlan,
    requests: requests ?? [],
  })
}

// POST /api/member-draft
// 회원이 draft 슬롯에 대한 수정 요청
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { month_id, request_type, draft_slot_id, requested_at, memo } = await req.json()

  if (!month_id || !request_type) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  // draft_open 확인
  const { data: month } = await supabaseAdmin
    .from('months')
    .select('draft_open')
    .eq('id', month_id)
    .single()

  if (!month?.draft_open) {
    return NextResponse.json({ error: '해당 월은 수정 요청 기간이 아닙니다' }, { status: 400 })
  }

  // change/exclude 시 해당 슬롯이 본인 것인지 확인
  if (draft_slot_id) {
    const { data: slot } = await supabaseAdmin
      .from('lesson_slots')
      .select('id, lesson_plan:lesson_plan_id(member_id)')
      .eq('id', draft_slot_id)
      .single()

    const memberId = (slot?.lesson_plan as any)?.member_id
    if (memberId !== session.id) {
      return NextResponse.json({ error: '본인 수업만 요청 가능합니다' }, { status: 403 })
    }
  }

  // 본인 플랜에서 coach_id 조회
  const { data: plan } = await supabaseAdmin
    .from('lesson_plans')
    .select('id, coach_id')
    .eq('member_id', session.id)
    .eq('month_id', month_id)
    .single()

  if (!plan) {
    return NextResponse.json({ error: '해당 월 플랜 없음' }, { status: 404 })
  }

  // 중복 요청 방지 (같은 슬롯에 이미 pending 요청 있으면 거절)
  if (draft_slot_id) {
    const { data: existing } = await supabaseAdmin
      .from('lesson_applications')
      .select('id')
      .eq('member_id', session.id)
      .eq('draft_slot_id', draft_slot_id)
      .in('status', ['pending_coach', 'pending_admin'])
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '이미 요청 중인 항목입니다' }, { status: 409 })
    }
  }

  // 요청 생성
  const { data, error } = await supabaseAdmin
    .from('lesson_applications')
    .insert({
      member_id:     session.id,
      coach_id:      plan.coach_id,
      month_id,
      request_type,
      draft_slot_id: draft_slot_id ?? null,
      requested_at:  requested_at ?? new Date().toISOString(),
      status:        'pending_coach',
      lesson_type:   request_type === 'add' ? '추가요청' :
                     request_type === 'change' ? '날짜변경요청' : '제외요청',
      duration_minutes: 60,
      admin_note:    memo ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 운영자/코치에게 알림
  const typeLabel = request_type === 'add' ? '날짜 추가' :
                    request_type === 'change' ? '날짜 변경' : '날짜 제외'

  await supabaseAdmin.from('notifications').insert({
    profile_id: plan.coach_id,
    title:      `📝 다음달 수업 ${typeLabel} 요청`,
    body:       `${session.name}님이 수업 ${typeLabel}을 요청했습니다.`,
    type:       'info',
    link:       '/owner/schedule-draft',
  })

  return NextResponse.json({ ok: true, id: data.id })
}

// DELETE /api/member-draft?request_id=xxx
// 회원이 본인 요청 취소
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const requestId = req.nextUrl.searchParams.get('request_id')
  if (!requestId) return NextResponse.json({ error: 'request_id 필요' }, { status: 400 })

  // 본인 요청이고 pending 상태인지 확인
  const { data: req_ } = await supabaseAdmin
    .from('lesson_applications')
    .select('id, status')
    .eq('id', requestId)
    .eq('member_id', session.id)
    .single()

  if (!req_) return NextResponse.json({ error: '요청 없음' }, { status: 404 })
  if (!['pending_coach', 'pending_admin'].includes(req_.status)) {
    return NextResponse.json({ error: '처리 완료된 요청은 취소할 수 없습니다' }, { status: 400 })
  }

  await supabaseAdmin
    .from('lesson_applications')
    .delete()
    .eq('id', requestId)

  return NextResponse.json({ ok: true })
}
