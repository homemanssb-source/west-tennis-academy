// src/app/api/schedule-draft/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import { recalcAndSavePlan } from '@/lib/calcAmount'

// GET /api/schedule-draft?month_id=xxx
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const monthId = req.nextUrl.searchParams.get('month_id')
  if (!monthId) return NextResponse.json({ error: 'month_id 필요' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, status, has_conflict,
      lesson_plan:lesson_plan_id (
        id, lesson_type, unit_minutes, amount,
        member:member_id ( id, name, phone ),
        coach:coach_id ( id, name )
      )
    `)
    .eq('status', 'draft')
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: planIds } = await supabaseAdmin
    .from('lesson_plans')
    .select('id')
    .eq('month_id', monthId)

  const validPlanIds = new Set((planIds ?? []).map((p: any) => p.id))
  const filtered = (data ?? []).filter((s: any) => validPlanIds.has(s.lesson_plan?.id))

  return NextResponse.json(filtered)
}

// POST /api/schedule-draft
// action: 'confirm_all' | 'confirm_one' | 'delete_one' | 'delete_all_conflict'
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { action, slot_id, month_id } = await req.json()

  // ── 단건 확정 ─────────────────────────────────────────────────────────
  if (action === 'confirm_one') {
    if (!slot_id) return NextResponse.json({ error: 'slot_id 필요' }, { status: 400 })

    const { data: slot } = await supabaseAdmin
      .from('lesson_slots')
      .select('id, scheduled_at, duration_minutes, lesson_plan_id, has_conflict')
      .eq('id', slot_id)
      .single()

    if (!slot) return NextResponse.json({ error: '슬롯 없음' }, { status: 404 })

    const { data: plan } = await supabaseAdmin
      .from('lesson_plans')
      .select('coach_id')
      .eq('id', slot.lesson_plan_id)
      .single()

    if (plan) {
      const { data: conflict } = await supabaseAdmin
        .from('lesson_slots')
        .select('id')
        .eq('scheduled_at', slot.scheduled_at)
        .eq('status', 'scheduled')
        .neq('lesson_plan_id', slot.lesson_plan_id)
        .maybeSingle()

      if (conflict) {
        return NextResponse.json({ error: '해당 시간에 이미 확정된 수업이 있습니다' }, { status: 409 })
      }
    }

    const { error } = await supabaseAdmin
      .from('lesson_slots')
      .update({ status: 'scheduled', has_conflict: false })
      .eq('id', slot_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // total_count 업데이트 → 금액 재계산 ✅
    await updatePlanTotalCount(slot.lesson_plan_id)
    await recalcAndSavePlan(slot.lesson_plan_id)

    return NextResponse.json({ ok: true })
  }

  // ── 일괄 확정 (충돌 제외) ─────────────────────────────────────────────
  if (action === 'confirm_all') {
    if (!month_id) return NextResponse.json({ error: 'month_id 필요' }, { status: 400 })

    const { data: planIds } = await supabaseAdmin
      .from('lesson_plans')
      .select('id')
      .eq('month_id', month_id)

    const validIds = (planIds ?? []).map((p: any) => p.id)
    if (validIds.length === 0) return NextResponse.json({ ok: true, confirmed: 0 })

    const { data: draftSlots } = await supabaseAdmin
      .from('lesson_slots')
      .select('id, lesson_plan_id')
      .in('lesson_plan_id', validIds)
      .eq('status', 'draft')
      .eq('has_conflict', false)

    if (!draftSlots || draftSlots.length === 0) {
      return NextResponse.json({ ok: true, confirmed: 0 })
    }

    const slotIds = draftSlots.map((s: any) => s.id)
    const { error } = await supabaseAdmin
      .from('lesson_slots')
      .update({ status: 'scheduled' })
      .in('id', slotIds)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // total_count 업데이트 → 금액 재계산 ✅
    const affectedPlanIds = [...new Set(draftSlots.map((s: any) => s.lesson_plan_id))]
    for (const planId of affectedPlanIds) {
      await updatePlanTotalCount(planId)
      await recalcAndSavePlan(planId)
    }

    // 회원 알림
    const { data: plans } = await supabaseAdmin
      .from('lesson_plans')
      .select('member_id, month:month_id(year, month)')
      .in('id', affectedPlanIds)

    if (plans && plans.length > 0) {
      const month = (plans[0] as any).month
      const notifs = [...new Set(plans.map((p: any) => p.member_id))].map((id: string) => ({
        profile_id: id,
        title: `✅ ${month?.year}년 ${month?.month}월 수업 확정`,
        body: `다음달 수업 일정이 확정되었습니다. 일정을 확인하세요!`,
        type: 'success',
        link: '/member/schedule',
      }))
      await supabaseAdmin.from('notifications').insert(notifs)
    }

    return NextResponse.json({ ok: true, confirmed: slotIds.length })
  }

  // ── 단건 삭제 ─────────────────────────────────────────────────────────
  if (action === 'delete_one') {
    if (!slot_id) return NextResponse.json({ error: 'slot_id 필요' }, { status: 400 })

    const { data: slot } = await supabaseAdmin
      .from('lesson_slots')
      .select('lesson_plan_id')
      .eq('id', slot_id)
      .single()

    const { error } = await supabaseAdmin
      .from('lesson_slots')
      .delete()
      .eq('id', slot_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (slot) await updatePlanTotalCount(slot.lesson_plan_id)

    return NextResponse.json({ ok: true })
  }

  // ── 충돌 슬롯 전체 삭제 ───────────────────────────────────────────────
  if (action === 'delete_all_conflict') {
    if (!month_id) return NextResponse.json({ error: 'month_id 필요' }, { status: 400 })

    const { data: planIds } = await supabaseAdmin
      .from('lesson_plans')
      .select('id')
      .eq('month_id', month_id)

    const validIds = (planIds ?? []).map((p: any) => p.id)
    if (validIds.length === 0) return NextResponse.json({ ok: true, deleted: 0 })

    const { data: conflictSlots } = await supabaseAdmin
      .from('lesson_slots')
      .select('id, lesson_plan_id')
      .in('lesson_plan_id', validIds)
      .eq('status', 'draft')
      .eq('has_conflict', true)

    if (!conflictSlots || conflictSlots.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 })
    }

    const slotIds = conflictSlots.map((s: any) => s.id)
    await supabaseAdmin.from('lesson_slots').delete().in('id', slotIds)

    return NextResponse.json({ ok: true, deleted: slotIds.length })
  }

  return NextResponse.json({ error: '잘못된 action' }, { status: 400 })
}

// ── 헬퍼: lesson_plan total_count 업데이트 ────────────────────────────
async function updatePlanTotalCount(planId: string) {
  const { count } = await supabaseAdmin
    .from('lesson_slots')
    .select('*', { count: 'exact', head: true })
    .eq('lesson_plan_id', planId)
    .eq('status', 'scheduled')

  await supabaseAdmin
    .from('lesson_plans')
    .update({ total_count: count ?? 0 })
    .eq('id', planId)
}