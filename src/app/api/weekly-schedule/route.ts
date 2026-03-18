import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const week = req.nextUrl.searchParams.get('week')
  if (!week) return NextResponse.json({ error: 'week 필요' }, { status: 400 })

  const startStr   = `${week}T00:00:00+09:00`
  const startDate  = week
  const endDateObj = new Date(`${week}T12:00:00+09:00`)
  endDateObj.setDate(endDateObj.getDate() + 6)
  const endDate = endDateObj.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const endStr  = `${endDate}T23:59:59+09:00`

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${week}T12:00:00+09:00`)
    d.setDate(d.getDate() + i)
    return d.getDay()
  })

  const [{ data: rawSlots }, { data: allBlocks }] = await Promise.all([
    supabaseAdmin
      .from('lesson_slots')
      .select(`
        id, scheduled_at, duration_minutes, status, is_makeup,
        lesson_plan:lesson_plan_id (
          lesson_type,
          member:member_id ( id, name ),
          coach:coach_id ( id, name )
        )
      `)
      .gte('scheduled_at', startStr)
      .lte('scheduled_at', endStr)
      .order('scheduled_at', { ascending: true }),

    supabaseAdmin
      .from('coach_blocks')
      .select('id, coach_id, block_date, block_start, block_end, reason, repeat_weekly, day_of_week')
      .or(`and(repeat_weekly.eq.false,block_date.gte.${startDate},block_date.lte.${endDate}),repeat_weekly.eq.true`),
  ])

  // display_name: 회원 이름 사용 (family_member는 lesson_plans에 없으므로 제거)
  const slots = (rawSlots ?? []).map((s: any) => ({
    ...s,
    display_name: s.lesson_plan?.member?.name ?? '-',
  }))

  const blocks = (allBlocks ?? []).filter(b => {
    if (!b.repeat_weekly) return true
    return weekDays.includes(b.day_of_week)
  })

  return NextResponse.json({ slots, blocks })
}