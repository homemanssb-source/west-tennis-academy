import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  if (kst.getDate() !== 15) return NextResponse.json({ ok: true, skipped: 'not 15th' })

  // 현재 달과 다음 달 month 레코드 확인
  const thisYear  = kst.getFullYear()
  const thisMonth = kst.getMonth() + 1
  const nextMonth = thisMonth === 12 ? 1 : thisMonth + 1
  const nextYear  = thisMonth === 12 ? thisYear + 1 : thisYear

  const { data: nextMonthRecord } = await supabaseAdmin
    .from('months')
    .select('id')
    .eq('year', nextYear)
    .eq('month', nextMonth)
    .single()

  // 다음달 month 없으면 자동 생성
  let nextMonthId = nextMonthRecord?.id
  if (!nextMonthId) {
    const startDate = new Date(nextYear, nextMonth - 1, 1).toISOString().split('T')[0]
    const endDate   = new Date(nextYear, nextMonth, 0).toISOString().split('T')[0]
    const { data: created } = await supabaseAdmin
      .from('months')
      .insert({ year: nextYear, month: nextMonth, start_date: startDate, end_date: endDate })
      .select('id')
      .single()
    nextMonthId = created?.id
  }

  if (!nextMonthId) return NextResponse.json({ error: '다음달 month 생성 실패' }, { status: 500 })

  // 이번달 레슨플랜 조회 (next_month_synced = false)
  const { data: currentMonth } = await supabaseAdmin
    .from('months')
    .select('id')
    .eq('year', thisYear)
    .eq('month', thisMonth)
    .single()

  if (!currentMonth) return NextResponse.json({ ok: true, skipped: 'no current month' })

  const { data: plans } = await supabaseAdmin
    .from('lesson_plans')
    .select('*')
    .eq('month_id', currentMonth.id)
    .eq('next_month_synced', false)

  if (!plans || plans.length === 0) return NextResponse.json({ ok: true, synced: 0 })

  // 다음달 레슨플랜 생성 (슬롯 없이 플랜만)
  const newPlans = plans.map((p: any) => ({
    member_id:       p.member_id,
    coach_id:        p.coach_id,
    month_id:        nextMonthId,
    lesson_type:     p.lesson_type,
    total_count:     p.total_count,
    completed_count: 0,
    payment_status:  'unpaid',
    amount:          p.amount,
    unit_minutes:    p.unit_minutes,
    program_id:      p.program_id ?? null,
    next_month_synced: false,
  }))

  const { error } = await supabaseAdmin.from('lesson_plans').insert(newPlans)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 현재달 플랜 synced 표시
  const planIds = plans.map((p: any) => p.id)
  await supabaseAdmin.from('lesson_plans').update({ next_month_synced: true }).in('id', planIds)

  // 회원들에게 알림
  const memberIds = [...new Set(plans.map((p: any) => p.member_id))]
  const notifs = memberIds.map((id: string) => ({
    profile_id: id,
    title: `📅 ${nextYear}년 ${nextMonth}월 레슨 등록 완료`,
    body: `다음달 레슨 일정이 등록되었습니다. 일정을 확인해주세요.`,
    type: 'success',
    link: '/member/schedule',
  }))
  await supabaseAdmin.from('notifications').insert(notifs)

  return NextResponse.json({ ok: true, synced: plans.length })
}
