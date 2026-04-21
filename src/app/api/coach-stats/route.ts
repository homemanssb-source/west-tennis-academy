import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const monthId = req.nextUrl.searchParams.get('month_id')
  if (!monthId) return NextResponse.json({ error: 'month_id 필요' }, { status: 400 })

  const [{ data: coaches }, { data: plans }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, name').eq('role', 'coach').eq('is_active', true),
    supabaseAdmin.from('lesson_plans').select(`
      id, coach_id, member_id, total_count, completed_count, lesson_type,
      slots:lesson_slots ( id, status, duration_minutes )
    `).eq('month_id', monthId),
  ])

  // ✅ perf: plans 를 coach_id 로 pre-index → O(n²) 제거
  const plansByCoach = new Map<string, any[]>()
  for (const p of plans ?? []) {
    if (!plansByCoach.has(p.coach_id)) plansByCoach.set(p.coach_id, [])
    plansByCoach.get(p.coach_id)!.push(p)
  }

  const stats = (coaches ?? []).map((c: any) => {
    const myPlans = plansByCoach.get(c.id) ?? []
    let totalSlots = 0, completedSlots = 0, absentSlots = 0, scheduledSlots = 0, totalMinutes = 0
    const memberSet = new Set<string>()
    for (const p of myPlans) {
      memberSet.add(p.member_id)
      for (const s of p.slots ?? []) {
        totalSlots++
        totalMinutes += s.duration_minutes ?? 0
        if (s.status === 'completed') completedSlots++
        else if (s.status === 'absent') absentSlots++
        else if (s.status === 'scheduled') scheduledSlots++
      }
    }
    const attendanceRate = totalSlots > 0 ? Math.round(completedSlots / totalSlots * 100) : 0
    return {
      id: c.id, name: c.name,
      totalSlots, completedSlots, absentSlots, scheduledSlots,
      attendanceRate, totalMinutes,
      memberCount: memberSet.size,
      planCount: myPlans.length,
    }
  }).filter((c: any) => c.planCount > 0).sort((a: any, b: any) => b.totalSlots - a.totalSlots)

  return NextResponse.json(stats)
}
