import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  // 매월 1일만 실행
  if (kst.getDate() !== 1) return NextResponse.json({ ok: true, skipped: true })

  const { data: unpaid } = await supabaseAdmin
    .from('lesson_plans')
    .select('id, amount, member_id, lesson_type, month:month_id(year, month)')
    .eq('payment_status', 'unpaid')

  if (!unpaid || unpaid.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const inserts = unpaid.map((p: any) => ({
    profile_id: p.member_id,
    title: '💰 미납 수강료 안내',
    body: `${p.month?.year}년 ${p.month?.month}월 ${p.lesson_type} 수강료 ${p.amount?.toLocaleString('ko-KR')}원이 미납 중입니다.`,
    type: 'warning',
    link: '/member/payment',
  }))

  await supabaseAdmin.from('notifications').insert(inserts)
  return NextResponse.json({ ok: true, sent: inserts.length })
}
