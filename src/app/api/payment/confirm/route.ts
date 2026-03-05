import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function parseSession(raw: string | undefined) {
  if (!raw) return null
  try {
    const s = JSON.parse(Buffer.from(raw, 'base64').toString())
    if (s.exp < Date.now()) return null
    return s
  } catch { return null }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  try {
    const { planId, memberId, amount, method, memo } = await request.json()
    const admin = await createAdminClient()

    // 플랜 조회
    const { data: plan } = await admin
      .from('lesson_plans')
      .select('price, payment_status')
      .eq('id', planId)
      .single()

    if (!plan) return NextResponse.json({ error: '플랜을 찾을 수 없습니다.' }, { status: 404 })

    // 결제 내역 추가
    await admin.from('payments').insert({
      lesson_plan_id: planId,
      member_id: memberId,
      amount,
      method: method ?? null,
      memo: memo ?? null,
      paid_at: new Date().toISOString(),
      confirmed_by: session.userId,
    })

    // 납부 상태 업데이트
    const newStatus = amount >= (plan.price ?? 0) ? 'paid' : 'partial'
    await admin.from('lesson_plans')
      .update({ payment_status: newStatus })
      .eq('id', planId)

    return NextResponse.json({ success: true, status: newStatus })
  } catch (e) {
    console.error('납부 확인 오류:', e)
    return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 })
  }
}
