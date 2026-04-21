// src/app/api/member-draft/route.ts
// ✅ [FIX] plan 조회 .single() → .maybeSingle() + 복수 플랜 대응
// ✅ [FIX] 수정 요청 알림을 코치 + 운영자/admin 모두에게 발송
// ✅ [FIX] 중복 요청 방지 쿼리 안정화
// ✅ [NEW] 'change' 요청 시 희망 날짜(hope_date) 필드 수신
// ✅ [NEW] request_type='exclude' 는 승인 대기 없이 즉시 삭제 (draft 슬롯만 해당)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import { recalcAndSavePlan } from '@/lib/calcAmount'

// GET /api/member-draft?month_id=xxx
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const monthId = req.nextUrl.searchParams.get('month_id')
  if (!monthId) return NextResponse.json({ error: 'month_id 필요' }, { status: 400 })

  const { data: month } = await supabaseAdmin
    .from('months')
    .select('id, year, month, draft_open')
    .eq('id', monthId)
    .single()

  if (!month) return NextResponse.json({ error: '해당 월 없음' }, { status: 404 })
  if (!month.draft_open) return NextResponse.json({ draftOpen: false, slots: [] })

  // 본인 플랜 전체 조회 (복수 플랜 지원)
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

  // 기존 수정 요청 조회
  const { data: requests } = await supabaseAdmin
    .from('lesson_applications')
    .select('id, requested_at, request_type, draft_slot_id, status, coach_note, admin_note')
    .eq('member_id', session.id)
    .eq('month_id', monthId)
    .in('request_type', ['change', 'exclude', 'add'])
    .in('status', ['pending_coach', 'pending_admin', 'approved', 'rejected'])

  const planMap = new Map(plans.map((p: any) => [p.id, p]))
  const slotsWithPlan = (slots ?? []).map((s: any) => ({
    ...s,
    lesson_type:    planMap.get(s.lesson_plan_id)?.lesson_type ?? '',
    coach_name:     planMap.get(s.lesson_plan_id)?.coach?.name ?? '',
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
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const {
    month_id,
    request_type,
    draft_slot_id,
    requested_at,
    memo,
    hope_date,    // ✅ [NEW] 변경 희망 날짜 (change 요청 시)
  } = await req.json()

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

  // ✅ request_type='exclude' → 승인 대기 없이 즉시 draft 삭제 (본인 초안 슬롯만)
  if (request_type === 'exclude') {
    if (!draft_slot_id) {
      return NextResponse.json({ error: 'draft_slot_id 필요' }, { status: 400 })
    }

    const { data: slot } = await supabaseAdmin
      .from('lesson_slots')
      .select('id, status, lesson_plan_id, scheduled_at, lesson_plan:lesson_plan_id(id, coach_id, member_id)')
      .eq('id', draft_slot_id)
      .single()

    if (!slot) return NextResponse.json({ error: '슬롯 없음' }, { status: 404 })
    if (slot.status !== 'draft') {
      return NextResponse.json({ error: '확정된 수업은 취소 요청이 필요합니다 (관리자 문의)' }, { status: 400 })
    }

    // FK 참조 해제 + 삭제
    await supabaseAdmin
      .from('lesson_applications')
      .update({ original_slot_id: null })
      .eq('original_slot_id', draft_slot_id)

    const { error: delErr } = await supabaseAdmin
      .from('lesson_slots')
      .delete()
      .eq('id', draft_slot_id)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    const planId = slot.lesson_plan_id
    if (planId) {
      // total_count 재계산 + 금액 재계산
      const { count } = await supabaseAdmin
        .from('lesson_slots')
        .select('id', { count: 'exact', head: true })
        .eq('lesson_plan_id', planId)
        .in('status', ['scheduled', 'completed', 'draft'])
      await supabaseAdmin.from('lesson_plans').update({ total_count: count ?? 0 }).eq('id', planId)
      await recalcAndSavePlan(planId)
    }

    // 코치 + owner/admin 정보성 알림
    const coachId = (slot.lesson_plan as any)?.coach_id
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', ['owner', 'admin'])
      .eq('is_active', true)

    const notifTargets = new Set<string>()
    if (coachId) notifTargets.add(coachId)
    for (const a of admins ?? []) notifTargets.add(a.id)

    if (notifTargets.size > 0) {
      await supabaseAdmin.from('notifications').insert(
        Array.from(notifTargets).map(pid => ({
          profile_id: pid,
          title: '🗑 초안 수업 제외',
          body: `${session.name}님이 다음달 초안 수업 1건을 제외하였습니다.`,
          type: 'info',
          link: '/owner/schedule-draft',
        })),
      )
    }

    return NextResponse.json({ ok: true, deleted: true })
  }

  // ✅ [FIX] 복수 플랜 대응: .single() → 첫 번째 플랜 사용 + draft_slot_id로 정확한 플랜 찾기
  let plan: any = null

  if (draft_slot_id) {
    // 슬롯이 있으면 슬롯의 lesson_plan_id로 코치 정보 조회 (정확)
    const { data: slotPlan } = await supabaseAdmin
      .from('lesson_slots')
      .select('lesson_plan:lesson_plan_id(id, coach_id)')
      .eq('id', draft_slot_id)
      .single()
    plan = (slotPlan?.lesson_plan as any) ?? null
  } else {
    // add 요청처럼 슬롯 없는 경우: 첫 번째 플랜 사용
    const { data: plans } = await supabaseAdmin
      .from('lesson_plans')
      .select('id, coach_id')
      .eq('member_id', session.id)
      .eq('month_id', month_id)
      .limit(1)
    plan = plans?.[0] ?? null
  }

  if (!plan) {
    return NextResponse.json({ error: '해당 월 플랜 없음' }, { status: 404 })
  }

  // 중복 요청 방지 (같은 슬롯에 이미 pending 요청)
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

  // ✅ [NEW] hope_date를 admin_note에 포함
  const typeLabel = request_type === 'add' ? '날짜 추가' :
                    request_type === 'change' ? '날짜 변경' : '날짜 제외'

  const adminNoteparts: string[] = []
  if (memo) adminNoteparts.push(memo)
  if (hope_date && request_type === 'change') {
    adminNoteparts.push(`희망 날짜: ${hope_date}`)
  }

  const { data, error } = await supabaseAdmin
    .from('lesson_applications')
    .insert({
      member_id:        session.id,
      coach_id:         plan.coach_id,
      month_id,
      request_type,
      draft_slot_id:    draft_slot_id ?? null,
      requested_at:     requested_at ?? new Date().toISOString(),
      status:           'pending_coach',
      lesson_type:      request_type === 'add' ? '추가요청' :
                        request_type === 'change' ? '날짜변경요청' : '제외요청',
      duration_minutes: 60,
      admin_note:       adminNoteparts.length > 0 ? adminNoteparts.join(' / ') : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ✅ [FIX] 알림: 코치 + 운영자/admin 모두에게 발송
  const notifBody = `${session.name}님이 수업 ${typeLabel}을 요청했습니다.${hope_date && request_type === 'change' ? ` (희망 날짜: ${hope_date})` : ''}`

  const notifInserts: any[] = [
    {
      profile_id: plan.coach_id,
      title:      `📝 다음달 수업 ${typeLabel} 요청`,
      body:       notifBody,
      type:       'info',
      link:       '/owner/schedule-draft',
    },
  ]

  // 운영자/admin에게도 알림
  const { data: admins } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role', ['owner', 'admin'])
    .eq('is_active', true)

  for (const admin of admins ?? []) {
    if (admin.id !== plan.coach_id) {  // 코치가 owner/admin일 때 중복 방지
      notifInserts.push({
        profile_id: admin.id,
        title:      `📝 다음달 수업 ${typeLabel} 요청`,
        body:       notifBody,
        type:       'info',
        link:       '/owner/schedule-draft',
      })
    }
  }

  await supabaseAdmin.from('notifications').insert(notifInserts)

  return NextResponse.json({ ok: true, id: data.id })
}

// DELETE /api/member-draft?request_id=xxx
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const requestId = req.nextUrl.searchParams.get('request_id')
  if (!requestId) return NextResponse.json({ error: 'request_id 필요' }, { status: 400 })

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