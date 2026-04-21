// src/app/api/schedule-draft/route.ts
// ✅ fix: family_member_name — lesson_plans.family_member_id 직접 join으로 조회
// ✅ fix: confirm_all 타임아웃 — recalcAndSavePlan Promise.all 병렬처리 + try/catch 분리
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

  // ✅ perf: !inner join + month_id 로 서버 측에서 필터
  //   기존: 전 DB 의 draft slot 다 fetch → JS 에서 월 필터 (대규모 DB 에서 수백 ms)
  //   개선: lesson_plans.month_id 로 inner join 필터 → 해당 월 slot 만 조회
  const { data, error } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, status, has_conflict,
      lesson_plan:lesson_plan_id!inner (
        id, lesson_type, unit_minutes, amount, month_id,
        family_member_id,
        member:member_id ( id, name, phone ),
        coach:coach_id ( id, name ),
        family_member:family_member_id ( id, name )
      )
    `)
    .eq('status', 'draft')
    .eq('lesson_plan.month_id', monthId)
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = (data ?? []).map((s: any) => ({
    ...s,
    family_member_name: s.lesson_plan?.family_member?.name ?? null,
  }))

  return NextResponse.json(enriched)
}

// POST /api/schedule-draft
// action: 'confirm_all' | 'confirm_one' | 'delete_one' | 'delete_all_conflict'
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { action, slot_id, slot_ids, month_id } = await req.json()

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

    // ✅ 병렬 처리
    await Promise.all([
      updatePlanTotalCount(slot.lesson_plan_id),
      recalcAndSavePlan(slot.lesson_plan_id),
    ])

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

    // ✅ lesson_plan_id 조건으로 직접 UPDATE (slotIds 배열이 수백~수천 개면 URL 초과 → 400)
    const { error } = await supabaseAdmin
      .from('lesson_slots')
      .update({ status: 'scheduled' })
      .in('lesson_plan_id', validIds)
      .eq('status', 'draft')
      .eq('has_conflict', false)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ✅ 금액 재계산: 모든 플랜 병렬 처리 + 타임아웃 방어
    const affectedPlanIds = [...new Set(draftSlots.map((s: any) => s.lesson_plan_id as string))]

    await Promise.all(
      affectedPlanIds.map(async (planId) => {
        try {
          await updatePlanTotalCount(planId)
          await recalcAndSavePlan(planId)
        } catch (e) {
          console.error('recalc failed for plan', planId, e)
        }
      })
    )

    // ✅ 알림: 병렬 처리
    try {
      const { data: plans } = await supabaseAdmin
        .from('lesson_plans')
        .select('member_id, month:month_id(year, month)')
        .in('id', affectedPlanIds)

      if (plans && plans.length > 0) {
        const month = (plans[0] as any).month
        const notifs = [...new Set(plans.map((p: any) => p.member_id as string))].map((id) => ({
          profile_id: id,
          title: `✅ ${month?.year}년 ${month?.month}월 수업 확정`,
          body: `다음달 수업 일정이 확정되었습니다. 일정을 확인하세요!`,
          type: 'success',
          link: '/member/schedule',
        }))
        await supabaseAdmin.from('notifications').insert(notifs)
      }
    } catch (e) {
      console.error('알림 발송 실패', e)
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

  // ── 선택 일괄 삭제 ────────────────────────────────────────────────────
  if (action === 'delete_many') {
    if (!Array.isArray(slot_ids) || slot_ids.length === 0) {
      return NextResponse.json({ error: 'slot_ids 필요' }, { status: 400 })
    }

    // 삭제 전 영향받을 plan_id 들 조회 (total_count 재계산용)
    const { data: targets } = await supabaseAdmin
      .from('lesson_slots')
      .select('id, lesson_plan_id, status')
      .in('id', slot_ids)

    if (!targets || targets.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 })
    }

    // draft 상태만 삭제 허용 — 확정된(scheduled/completed) 슬롯 실수 삭제 방지
    const draftIds = targets.filter((s: any) => s.status === 'draft').map((s: any) => s.id)
    if (draftIds.length === 0) {
      return NextResponse.json({ error: '초안 상태의 슬롯만 삭제 가능합니다' }, { status: 400 })
    }

    // FK 참조 해제
    await supabaseAdmin
      .from('lesson_applications')
      .update({ original_slot_id: null })
      .in('original_slot_id', draftIds)

    const { error } = await supabaseAdmin.from('lesson_slots').delete().in('id', draftIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 영향받은 plan 의 total_count 재계산
    const affectedPlanIds = [...new Set(
      targets
        .filter((s: any) => draftIds.includes(s.id))
        .map((s: any) => s.lesson_plan_id as string)
    )]
    await Promise.all(affectedPlanIds.map(id => updatePlanTotalCount(id)))

    return NextResponse.json({ ok: true, deleted: draftIds.length })
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
