// src/app/api/payment/toss/route.ts
// ================================================================
// POST → 운영자 전용: orderId 생성 + 결제 링크 반환
// GET  → 공개: 결제 페이지용 플랜 정보 조회 (로그인 불필요)
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// ── GET: 공개 API — 결제 페이지에서 플랜 정보 조회 ───────────────
// /api/payment/toss?plan_id=xxx
export async function GET(req: NextRequest) {
  const plan_id = req.nextUrl.searchParams.get('plan_id')
  if (!plan_id) return NextResponse.json({ error: 'plan_id 필요' }, { status: 400 })

  const { data: plan, error } = await supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, amount, payment_status, lesson_type,
      member:profiles!lesson_plans_member_id_fkey(name),
      month:months(year, month),
      coach:profiles!lesson_plans_coach_id_fkey(name)
    `)
    .eq('id', plan_id)
    .single()

  if (error || !plan) {
    return NextResponse.json({ error: '플랜 정보 없음' }, { status: 404 })
  }

  if (plan.payment_status === 'paid') {
    return NextResponse.json({ error: '이미 납부 완료된 플랜입니다' }, { status: 400 })
  }

  if (!plan.amount || plan.amount <= 0) {
    return NextResponse.json({ error: '결제 금액이 0원입니다' }, { status: 400 })
  }

  // 기존 pending 결제의 orderId 조회
  const { data: existing } = await supabaseAdmin
    .from('payments')
    .select('order_id')
    .eq('lesson_plan_id', plan_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const member = (plan as any).member
  const month  = (plan as any).month
  const coach  = (plan as any).coach

  return NextResponse.json({
    ok:          true,
    plan_id:     plan.id,
    amount:      plan.amount,
    order_id:    existing?.order_id ?? null,  // null이면 pay 페이지에서 새로 생성 요청
    member_name: member?.name ?? '',
    month:       `${month?.year}년 ${month?.month}월`,
    lesson:      `${(plan as any).lesson_type} · ${coach?.name} 코치`,
  })
}

// ── POST: 운영자 전용 — orderId 생성 + 결제 링크 반환 ─────────────
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin', 'payment'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { plan_id } = await req.json()
  if (!plan_id) return NextResponse.json({ error: 'plan_id 필요' }, { status: 400 })

  // 플랜 정보 조회
  const { data: plan, error: planErr } = await supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, amount, payment_status, member_id, lesson_type,
      member:profiles!lesson_plans_member_id_fkey(id, name, phone),
      month:months(year, month),
      coach:profiles!lesson_plans_coach_id_fkey(name)
    `)
    .eq('id', plan_id)
    .single()

  if (planErr || !plan) {
    return NextResponse.json({ error: '플랜 정보 없음' }, { status: 404 })
  }
  if (plan.payment_status === 'paid') {
    return NextResponse.json({ error: '이미 납부 완료된 플랜입니다' }, { status: 400 })
  }
  if (!plan.amount || plan.amount <= 0) {
    return NextResponse.json({ error: '결제 금액이 0원입니다' }, { status: 400 })
  }

  // 기존 pending 결제 있으면 재사용
  const { data: existing } = await supabaseAdmin
    .from('payments')
    .select('order_id')
    .eq('lesson_plan_id', plan_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let orderId: string

  if (existing?.order_id) {
    orderId = existing.order_id
  } else {
    // 새 orderId 생성
    orderId = `wta_${plan_id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`

    const { error: insertErr } = await supabaseAdmin
      .from('payments')
      .insert({
        lesson_plan_id: plan_id,
        member_id:      plan.member_id,
        amount:         plan.amount,
        order_id:       orderId,
        status:         'pending',
      })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://west-tennis-academy-1.vercel.app'
  const payUrl  = `${baseUrl}/pay/${plan_id}?orderId=${orderId}`

  const member = (plan as any).member
  const month  = (plan as any).month
  const coach  = (plan as any).coach

  return NextResponse.json({
    ok:          true,
    pay_url:     payUrl,
    order_id:    orderId,
    amount:      plan.amount,
    member_name: member?.name,
    month:       `${month?.year}년 ${month?.month}월`,
    lesson:      `${(plan as any).lesson_type} · ${coach?.name} 코치`,
  })
}
