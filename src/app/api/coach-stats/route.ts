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

  const stats = (coaches ?? []).map((c: any) => {
    const myPlans  = (plans ?? []).filter((p: any) => p.coach_id === c.id)
    const allSlots = myPlans.flatMap((p: any) => p.slots ?? [])
    const totalSlots     = allSlots.length
    const completedSlots = allSlots.filter((s: any) => s.status === 'completed').length
    const absentSlots    = allSlots.filter((s: any) => s.status === 'absent').length
    const scheduledSlots = allSlots.filter((s: any) => s.status === 'scheduled').length
    const totalMinutes   = allSlots.reduce((s: number, sl: any) => s + (sl.duration_minutes ?? 0), 0)
    const attendanceRate = totalSlots > 0 ? Math.round(completedSlots / totalSlots * 100) : 0
    const memberCount    = new Set(myPlans.map((p: any) => p.member_id)).size
    return { id: c.id, name: c.name, totalSlots, completedSlots, absentSlots, scheduledSlots, attendanceRate, totalMinutes, memberCount, planCount: myPlans.length }
  }).filter((c: any) => c.planCount > 0).sort((a: any, b: any) => b.totalSlots - a.totalSlots)

  return NextResponse.json(stats)
}
