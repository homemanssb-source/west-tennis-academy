// src/app/api/lesson-plans/[id]/route.ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { recalcAndSavePlan } from '@/lib/calcAmount'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, lesson_type, unit_minutes, total_count, completed_count,
      payment_status, amount, billing_count,
      sat_count, sun_count, discount_amount, discount_memo, created_at,
      member:profiles!lesson_plans_member_id_fkey(id, name, phone),
      coach:profiles!lesson_plans_coach_id_fkey(id, name),
      month:months(id, year, month),
      slots:lesson_slots(id, scheduled_at, duration_minutes, status, is_makeup, slot_type, memo),
      program:program_id(id, name, default_amount, per_session_price)
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    lesson_type, unit_minutes, amount, payment_status,
    coach_id, month_id,
    billing_count,    // ✅ 청구 횟수 수동 조정
    recalc,           // ✅ true 이면 저장 후 금액 재계산
  } = body

  const updates: Record<string, unknown> = {}
  if (lesson_type    !== undefined) updates.lesson_type    = lesson_type
  if (unit_minutes   !== undefined) updates.unit_minutes   = unit_minutes
  if (amount         !== undefined) updates.amount         = amount
  if (payment_status !== undefined) updates.payment_status = payment_status
  if (coach_id       !== undefined) updates.coach_id       = coach_id
  if (month_id       !== undefined) updates.month_id       = month_id
  if (billing_count  !== undefined) updates.billing_count  = billing_count  // ✅

  const { error } = await supabaseAdmin
    .from('lesson_plans')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ✅ recalc=true 이거나 billing_count가 바뀌면 금액 재계산
  if (recalc || billing_count !== undefined) {
    await recalcAndSavePlan(id)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. 이 plan의 lesson_slots ID 목록 조회
  const { data: slots } = await supabaseAdmin
    .from('lesson_slots')
    .select('id')
    .eq('lesson_plan_id', id)

  const slotIds = (slots ?? []).map((s: any) => s.id)

  // 2. lesson_applications의 original_slot_id 참조 해제
  if (slotIds.length > 0) {
    await supabaseAdmin
      .from('lesson_applications')
      .update({ original_slot_id: null })
      .in('original_slot_id', slotIds)
  }

  // 3. 이 plan의 lesson_applications 삭제
  const { data: plan } = await supabaseAdmin
    .from('lesson_plans')
    .select('member_id, coach_id, month_id')
    .eq('id', id)
    .single()

  if (plan) {
    await supabaseAdmin
      .from('lesson_applications')
      .delete()
      .eq('member_id', plan.member_id)
      .eq('coach_id',  plan.coach_id)
      .eq('month_id',  plan.month_id)
  }

  // 4. lesson_slots 삭제
  await supabaseAdmin.from('lesson_slots').delete().eq('lesson_plan_id', id)

  // 5. lesson_plans 삭제
  const { error } = await supabaseAdmin.from('lesson_plans').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}