import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  return Math.ceil((date.getDate() + firstDay) / 7)
}

export async function GET() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  // 월요일(1)이고 3주차인 경우만
  if (kst.getDay() !== 1) return NextResponse.json({ ok: true, skipped: 'not monday' })
  if (getWeekOfMonth(kst) !== 3) return NextResponse.json({ ok: true, skipped: 'not 3rd week' })

  // 다음 달 정보
  const nextMonth = kst.getMonth() + 2 // 1-based
  const nextYear  = nextMonth > 12 ? kst.getFullYear() + 1 : kst.getFullYear()
  const nm        = nextMonth > 12 ? 1 : nextMonth

  // 활성 회원 전체에게 알림
  const { data: members } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'member')
    .eq('is_active', true)

  if (!members || members.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const inserts = members.map((m: any) => ({
    profile_id: m.id,
    title: `📢 ${nextYear}년 ${nm}월 수강료 결제 안내`,
    body: `다음 달 수강료 결제 기간입니다. 이번 주 내로 납부해 주세요.`,
    type: 'info',
    link: '/member/payment',
  }))

  await supabaseAdmin.from('notifications').insert(inserts)
  return NextResponse.json({ ok: true, sent: inserts.length })
}
