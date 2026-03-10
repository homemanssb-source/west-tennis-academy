// ============================================================
// 저장 위치: app/api/schedule-draft/route.ts  (신규 파일)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// ── GET: 특정 월의 draft/conflict 슬롯 목록 ─────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role))
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const monthId = req.nextUrl.searchParams.get('month_id')
  if (!monthId) return NextResponse.json({ error: 'month_id 필요' }, { status: 400 })

  // 해당 월 lesson_plans
  const { data: plans } = await supabaseAdmin
    .from('lesson_plans')
    .select('id, lesson_type, unit_minutes, amount, member_id, coach_id')
    .eq('month_id', monthId)

  if (!plans || plans.length === 0) return NextResponse.json([])

  const planIds = plans.map((p: any) => p.id)

  // draft / conflict_pending 슬롯
  const { data: drafts } = await supabaseAdmin
    .from('lesson_slots')
    .select('id, lesson_plan_id, scheduled_at, duration_minutes, status, has_conflict')
    .in('lesson_plan_id', planIds)
    .in('status', ['draft', 'conflict_pending'])
    .order('scheduled_at', { ascending: true })

  if (!drafts || drafts.length === 0) return NextResponse.json([])

  // member / coach 정보 조합
  const profileIds = [...new Set([
    ...plans.map((p: any) => p.member_id),
    ...plans.map((p: any) => p.coach_id),
  ])]
  const { data: profiles } = await supabaseAdmin
    .from('profiles').select('id, name').in('id', profileIds)

  const profileMap: Record<string, string> = {}
  ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p.name })

  const planMap: Record<string, any> = {}
  plans.forEach((p: any) => { planMap[p.id] = p })

  const result = drafts.map((s: any) => {
    const plan = planMap[s.lesson_plan_id]
    return {
      ...s,
      member_name:  profileMap[plan?.member_id] ?? '-',
      coach_name:   profileMap[plan?.coach_id]  ?? '-',
      lesson_type:  plan?.lesson_type ?? '-',
    }
  })

  return NextResponse.json(result)
}

// ── POST: 일괄 확정 or 단건 확정 ─────────────────────────────────────────
// body: { action: 'confirm_all' | 'confirm_one' | 'delete_one', slot_id?, month_id?, skip_conflicts? }
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role))
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json()
  const { action, slot_id, month_id, skip_conflicts = true } = body

  // ── 단건 확정 ──────────────────────────────────────────────────────────
  if (action === 'confirm_one') {
    if (!slot_id) return NextResponse.json({ error: 'slot_id 필요' }, { status: 400 })

    const { data: slot } = await supabaseAdmin
      .from('lesson_slots').select('id, lesson_plan_id, has_conflict, status').eq('id', slot_id).single()

    if (!slot) return NextResponse.json({ error: '슬롯 없음' }, { status: 404 })
    if (!['draft', 'conflict_pending'].includes(slot.status))
      return NextResponse.json({ error: '이미 처리된 슬롯' }, { status: 409 })

    await supabaseAdmin.from('lesson_slots').update({ status: 'scheduled' }).eq('id', slot_id)
    await incrementTotalCount(slot.lesson_plan_id, 1)

    return NextResponse.json({ ok: true, confirmed: 1 })
  }

  // ── 단건 삭제 (초안에서 제거) ──────────────────────────────────────────
  if (action === 'delete_one') {
    if (!slot_id) return NextResponse.json({ error: 'slot_id 필요' }, { status: 400 })
    await supabaseAdmin.from('lesson_slots').delete().eq('id', slot_id)
    return NextResponse.json({ ok: true, deleted: 1 })
  }

  // ── 일괄 확정 ──────────────────────────────────────────────────────────
  if (action === 'confirm_all') {
    if (!month_id) return NextResponse.json({ error: 'month_id 필요' }, { status: 400 })

    const { data: plans } = await supabaseAdmin
      .from('lesson_plans').select('id, member_id, coach_id').eq('month_id', month_id)

    if (!plans || plans.length === 0)
      return NextResponse.json({ ok: true, confirmed: 0, skipped: 0 })

    const planIds = plans.map((p: any) => p.id)

    const { data: drafts } = await supabaseAdmin
      .from('lesson_slots')
      .select('id, lesson_plan_id, has_conflict, status')
      .in('lesson_plan_id', planIds)
      .in('status', ['draft', 'conflict_pending'])

    if (!drafts || drafts.length === 0)
      return NextResponse.json({ ok: true, confirmed: 0, skipped: 0 })

    const toConfirm = skip_conflicts
      ? drafts.filter((s: any) => !s.has_conflict)
      : drafts

    const toHold = skip_conflicts
      ? drafts.filter((s: any) => s.has_conflict)
      : []

    // draft → scheduled
    if (toConfirm.length > 0) {
      await supabaseAdmin
        .from('lesson_slots')
        .update({ status: 'scheduled' })
        .in('id', toConfirm.map((s: any) => s.id))
    }

    // conflict → conflict_pending (수동 처리 대기)
    if (toHold.length > 0) {
      await supabaseAdmin
        .from('lesson_slots')
        .update({ status: 'conflict_pending' })
        .in('id', toHold.map((s: any) => s.id))
    }

    // total_count 업데이트 (플랜별)
    const planCounts: Record<string, number> = {}
    toConfirm.forEach((s: any) => {
      planCounts[s.lesson_plan_id] = (planCounts[s.lesson_plan_id] ?? 0) + 1
    })
    for (const [pid, cnt] of Object.entries(planCounts)) {
      await incrementTotalCount(pid, cnt)
    }

    // 회원 확정 알림
    const { data: monthRec } = await supabaseAdmin
      .from('months').select('year, month').eq('id', month_id).single()
    const notified = new Set<string>()
    const notifInserts: any[] = []

    for (const s of toConfirm) {
      const plan = plans.find((p: any) => p.id === s.lesson_plan_id)
      if (!plan || notified.has(plan.member_id)) continue
      notified.add(plan.member_id)
      notifInserts.push({
        profile_id: plan.member_id,
        title: `🎾 ${monthRec?.year}년 ${monthRec?.month}월 수업 일정 확정!`,
        body:  `수업 일정이 확정됐습니다. 일정을 확인해주세요.`,
        type:  'success',
        link:  '/member/schedule',
      })
    }
    if (notifInserts.length > 0)
      await supabaseAdmin.from('notifications').insert(notifInserts)

    return NextResponse.json({
      ok: true,
      confirmed: toConfirm.length,
      skipped_conflict: toHold.length,
    })
  }

  return NextResponse.json({ error: '잘못된 action' }, { status: 400 })
}

// ── 헬퍼: total_count += n ────────────────────────────────────────────────
async function incrementTotalCount(planId: string, n: number) {
  // RPC가 있으면 좋지만 없으면 select → update 패턴
  const { data: plan } = await supabaseAdmin
    .from('lesson_plans').select('total_count').eq('id', planId).single()
  if (!plan) return
  await supabaseAdmin
    .from('lesson_plans')
    .update({ total_count: (plan.total_count ?? 0) + n })
    .eq('id', planId)
}