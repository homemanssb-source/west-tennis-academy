// src/app/api/weekly-schedule/route.ts
// ✅ fix: family_member_name 추가 (가족 신청 표시)
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

  const [{ data: slots }, { data: allBlocks }] = await Promise.all([
    supabaseAdmin
      .from('lesson_slots')
      .select(`
        id, scheduled_at, duration_minutes, status, is_makeup,
        lesson_plan:lesson_plan_id (
          id, lesson_type,
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

  // ✅ plan_id 목록으로 lesson_applications 조회 → family_member_id 확보
  const planIds = [...new Set((slots ?? []).map((s: any) => s.lesson_plan?.id).filter(Boolean))]
  const familyNameMap: Record<string, string> = {}  // plan_id → 자녀 이름

  if (planIds.length > 0) {
    const { data: apps } = await supabaseAdmin
      .from('lesson_applications')
      .select('lesson_plan_id, family_member_id')
      .in('lesson_plan_id', planIds)
      .not('family_member_id', 'is', null)

    if (apps && apps.length > 0) {
      const familyIds = [...new Set(apps.map((a: any) => a.family_member_id).filter(Boolean))]
      const { data: familyMembers } = await supabaseAdmin
        .from('family_members')
        .select('id, name')
        .in('id', familyIds)

      const fmMap = new Map((familyMembers ?? []).map((f: any) => [f.id, f.name]))
      apps.forEach((a: any) => {
        if (a.lesson_plan_id && a.family_member_id && fmMap.has(a.family_member_id)) {
          familyNameMap[a.lesson_plan_id] = fmMap.get(a.family_member_id)!
        }
      })
    }
  }

  // ✅ 슬롯에 family_member_name 주입
  const enrichedSlots = (slots ?? []).map((s: any) => ({
    ...s,
    family_member_name: s.lesson_plan?.id ? (familyNameMap[s.lesson_plan.id] ?? null) : null,
  }))

  const blocks = (allBlocks ?? []).filter(b =>
    b.repeat_weekly ? weekDays.includes(b.day_of_week) : true
  )

  return NextResponse.json({ slots: enrichedSlots, blocks })
}