import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const thisYear  = kst.getFullYear()
  const thisMonth = kst.getMonth() + 1
  const prevMonth = thisMonth === 1 ? 12 : thisMonth - 1
  const prevYear  = thisMonth === 1 ? thisYear - 1 : thisYear

  // 이번달 month_id
  const { data: thisMonthRec } = await supabaseAdmin
    .from('months').select('id').eq('year', thisYear).eq('month', thisMonth).single()

  // 저번달 month_id
  const { data: prevMonthRec } = await supabaseAdmin
    .from('months').select('id').eq('year', prevYear).eq('month', prevMonth).single()

  if (!prevMonthRec) return NextResponse.json({ unregistered: [], thisMonth: { year: thisYear, month: thisMonth }, prevMonth: { year: prevYear, month: prevMonth } })

  // 저번달 레슨 있었던 회원들
  const { data: prevPlans } = await supabaseAdmin
    .from('lesson_plans')
    .select('member_id, member:member_id(id, name, phone, coach:coach_id(name))')
    .eq('month_id', prevMonthRec.id)

  // 이번달 레슨 등록된 회원들
  const { data: thisPlans } = await supabaseAdmin
    .from('lesson_plans')
    .select('member_id')
    .eq('month_id', thisMonthRec?.id ?? 'none')

  const thisMonthMemberIds = new Set((thisPlans ?? []).map((p: any) => p.member_id))

  // 저번달엔 있었지만 이번달엔 없는 회원
  const seen = new Set<string>()
  const unregistered = (prevPlans ?? [])
    .filter((p: any) => !thisMonthMemberIds.has(p.member_id) && !seen.has(p.member_id) && seen.add(p.member_id))
    .map((p: any) => ({
      id: p.member_id,
      name: p.member?.name,
      phone: p.member?.phone,
      coach: p.member?.coach?.name,
    }))

  return NextResponse.json({
    unregistered,
    thisMonth: { year: thisYear, month: thisMonth },
    prevMonth: { year: prevYear, month: prevMonth },
  })
}
