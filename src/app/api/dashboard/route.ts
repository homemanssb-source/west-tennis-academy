import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const today = new Date()
  const kst = new Date(today.getTime() + 9 * 60 * 60 * 1000)
  const date = kst.toISOString().split('T')[0]
  const start = `${date}T00:00:00+09:00`
  const end   = `${date}T23:59:59+09:00`

  const [{ data: slots }, { data: coaches }] = await Promise.all([
    supabaseAdmin.from('lesson_slots').select(`
      id, scheduled_at, duration_minutes, status, is_makeup,
      lesson_plan:lesson_plan_id (
        lesson_type,
        member:member_id ( name ),
        coach:coach_id ( id, name )
      )
    `).gte('scheduled_at', start).lte('scheduled_at', end).order('scheduled_at'),
    supabaseAdmin.from('profiles').select('id, name').eq('role', 'coach').eq('is_active', true),
  ])

  const coachStats = (coaches ?? []).map((c: any) => {
    const mySlots = (slots ?? []).filter((s: any) => s.lesson_plan?.coach?.id === c.id)
    return {
      id: c.id,
      name: c.name,
      total: mySlots.length,
      completed: mySlots.filter((s: any) => s.status === 'completed').length,
      scheduled: mySlots.filter((s: any) => s.status === 'scheduled').length,
      absent: mySlots.filter((s: any) => s.status === 'absent').length,
      slots: mySlots.map((s: any) => ({
        id: s.id,
        time: s.scheduled_at,
        duration: s.duration_minutes,
        status: s.status,
        member: s.lesson_plan?.member?.name,
        lessonType: s.lesson_plan?.lesson_type,
        isMakeup: s.is_makeup,
      })).sort((a: any, b: any) => a.time.localeCompare(b.time)),
    }
  })

  const total     = (slots ?? []).length
  const completed = (slots ?? []).filter((s: any) => s.status === 'completed').length
  const scheduled = (slots ?? []).filter((s: any) => s.status === 'scheduled').length
  const absent    = (slots ?? []).filter((s: any) => s.status === 'absent').length

  return NextResponse.json({ date, total, completed, scheduled, absent, byCoach: coachStats })
}
