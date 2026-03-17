// src/app/api/payment/toss/order/route.ts
// 공개 API — 결제 페이지에서 orderId 신규 생성 (로그인 불필요)
// 운영자가 링크에 orderId를 포함하지 않은 경우 폴백으로 사용

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { plan_id } = await req.json()
  if (!plan_id) return NextResponse.json({ error: 'plan_id 필요' }, { status: 400 })

  // 플랜 존재 + 미납 확인
  const { data: plan, error: planErr } = await supabaseAdmin
    .from('lesson_plans')
    .select('id, amount, payment_status, member_id')
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

  // 기존 pending 재사용
  const { data: existing } = await supabaseAdmin
    .from('payments')
    .select('order_id')
    .eq('lesson_plan_id', plan_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.order_id) {
    return NextResponse.json({ ok: true, order_id: existing.order_id })
  }

  // 새 orderId 생성
  const orderId = `wta_${plan_id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`

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

  return NextResponse.json({ ok: true, order_id: orderId })
}
