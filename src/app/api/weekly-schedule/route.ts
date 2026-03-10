import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const week = req.nextUrl.searchParams.get('week') // YYYY-MM-DD (월요일)
  if (!week) return NextResponse.json({ error: 'week 필요' }, { status: 400 })

  const start = new Date(week)
  const end   = new Date(week)
  end.setDate(end.getDate() + 6)

  const startStr = `${start.toISOString().split('T')[0]}T00:00:00+09:00`
  const endStr   = `${end.toISOString().split('T')[0]}T23:59:59+09:00`
  const startDate = start.toISOString().split('T')[0]
  const endDate   = end.toISOString().split('T')[0]

  // 해당 주의 요일 배열 (0=일~6=토)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d.getDay()
  })

  const [{ data: slots }, { data: allBlocks }] = await Promise.all([
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

    // ✅ FIX #7: 해당 주 날짜 범위의 일회성 휴무 + 반복 휴무 모두 조회
    supabaseAdmin
      .from('coach_blocks')
      .select('id, coach_id, block_date, block_start, block_end, reason, repeat_weekly, day_of_week')
      .or(`and(repeat_weekly.eq.false,block_date.gte.${startDate},block_date.lte.${endDate}),repeat_weekly.eq.true`),
  ])

  // 반복 휴무는 해당 주에 포함된 요일만 필터링
  const blocks = (allBlocks ?? []).filter(b => {
    if (!b.repeat_weekly) return true // 일회성: 이미 날짜 범위 필터 완료
    return weekDays.includes(b.day_of_week) // 반복: 해당 주에 해당 요일 있는지
  })

  // ✅ 반환 형태: { slots, blocks } — 프론트에서 구분하여 렌더링
  return NextResponse.json({ slots: slots ?? [], blocks })
}