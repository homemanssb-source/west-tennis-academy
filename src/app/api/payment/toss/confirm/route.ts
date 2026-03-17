// src/app/api/payment/toss/confirm/route.ts
// 토스페이먼츠 결제 승인 처리
// 토스 결제창 완료 후 successUrl 리다이렉트 → 이 API 호출

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount } = await req.json()

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
  }

  // ── 1. payments 테이블에서 주문 확인 ──────────────────────────────
  const { data: payment, error: payErr } = await supabaseAdmin
    .from('payments')
    .select('id, lesson_plan_id, member_id, amount, status')
    .eq('order_id', orderId)
    .single()

  if (payErr || !payment) {
    return NextResponse.json({ error: '주문 정보 없음' }, { status: 404 })
  }

  // 이미 처리된 결제
  if (payment.status === 'done') {
    return NextResponse.json({ ok: true, already: true })
  }

  // 금액 위변조 검증
  if (payment.amount !== amount) {
    await supabaseAdmin
      .from('payments')
      .update({ status: 'failed' })
      .eq('order_id', orderId)
    return NextResponse.json({ error: '금액 불일치' }, { status: 400 })
  }

  // ── 2. 토스페이먼츠 승인 API 호출 ────────────────────────────────
  const secretKey = process.env.TOSSPAYMENTS_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: '시크릿 키 없음' }, { status: 500 })
  }

  const encoded = Buffer.from(`${secretKey}:`).toString('base64')

  const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${encoded}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })

  const tossData = await tossRes.json()

  if (!tossRes.ok) {
    // 토스 승인 실패
    await supabaseAdmin
      .from('payments')
      .update({ status: 'failed', raw_response: tossData })
      .eq('order_id', orderId)

    return NextResponse.json(
      { error: tossData.message ?? '결제 승인 실패' },
      { status: 400 }
    )
  }

  // ── 3. payments 테이블 업데이트 ──────────────────────────────────
  await supabaseAdmin
    .from('payments')
    .update({
      payment_key:  paymentKey,
      method:       tossData.method,
      status:       'done',
      approved_at:  tossData.approvedAt ?? new Date().toISOString(),
      raw_response: tossData,
    })
    .eq('order_id', orderId)

  // ── 4. lesson_plans payment_status = 'paid' ───────────────────────
  await supabaseAdmin
    .from('lesson_plans')
    .update({ payment_status: 'paid' })
    .eq('id', payment.lesson_plan_id)

  // ── 5. 플랜 + 회원 정보 조회 (알림용) ────────────────────────────
  const { data: plan } = await supabaseAdmin
    .from('lesson_plans')
    .select(`
      lesson_type, amount,
      member:profiles!lesson_plans_member_id_fkey(id, name),
      month:months(year, month),
      coach:profiles!lesson_plans_coach_id_fkey(name)
    `)
    .eq('id', payment.lesson_plan_id)
    .single()

  const member = (plan as any)?.member
  const month  = (plan as any)?.month
  const coach  = (plan as any)?.coach

  // ── 6. 회원 앱 알림 ──────────────────────────────────────────────
  if (member?.id) {
    await supabaseAdmin.from('notifications').insert({
      profile_id: member.id,
      title:      '✅ 레슨비 결제 완료',
      body:       `${month?.year}년 ${month?.month}월 레슨비 ${amount.toLocaleString('ko-KR')}원 결제가 완료되었습니다.`,
      type:       'success',
      link:       '/member/payment',
    })
  }

  // ── 7. 운영자/관리자 알림 ────────────────────────────────────────
  const { data: owners } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role', ['owner', 'admin'])
    .eq('is_active', true)

  if (owners && owners.length > 0) {
    await supabaseAdmin.from('notifications').insert(
      owners.map((o: any) => ({
        profile_id: o.id,
        title:      '💰 레슨비 결제 완료',
        body:       `${member?.name}님이 ${month?.year}년 ${month?.month}월 레슨비 ${amount.toLocaleString('ko-KR')}원을 결제했습니다.`,
        type:       'success',
        link:       '/owner/payment',
      }))
    )
  }

  return NextResponse.json({
    ok:          true,
    member_name: member?.name,
    amount,
    month:       `${month?.year}년 ${month?.month}월`,
    lesson:      `${(plan as any)?.lesson_type} · ${coach?.name} 코치`,
    method:      tossData.method,
    approved_at: tossData.approvedAt,
  })
}
