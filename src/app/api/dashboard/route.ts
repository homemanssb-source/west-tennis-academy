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

  // ✅ perf: O(n²) filter 반복 → 1회 패스로 pre-index + 집계
  const slotsByCoach = new Map<string, any[]>()
  let total = 0, completed = 0, scheduled = 0, absent = 0
  for (const s of slots ?? []) {
    total++
    if (s.status === 'completed') completed++
    else if (s.status === 'scheduled') scheduled++
    else if (s.status === 'absent') absent++
    const cid = (s.lesson_plan as any)?.coach?.id
    if (!cid) continue
    if (!slotsByCoach.has(cid)) slotsByCoach.set(cid, [])
    slotsByCoach.get(cid)!.push(s)
  }

  const coachStats = (coaches ?? []).map((c: any) => {
    const mySlots = slotsByCoach.get(c.id) ?? []
    let cCompleted = 0, cScheduled = 0, cAbsent = 0
    const mapped = mySlots.map((s: any) => {
      if (s.status === 'completed') cCompleted++
      else if (s.status === 'scheduled') cScheduled++
      else if (s.status === 'absent') cAbsent++
      return {
        id: s.id,
        time: s.scheduled_at,
        duration: s.duration_minutes,
        status: s.status,
        member: s.lesson_plan?.member?.name,
        lessonType: s.lesson_plan?.lesson_type,
        isMakeup: s.is_makeup,
      }
    })
    mapped.sort((a: any, b: any) => a.time.localeCompare(b.time))
    return {
      id: c.id,
      name: c.name,
      total: mySlots.length,
      completed: cCompleted,
      scheduled: cScheduled,
      absent: cAbsent,
      slots: mapped,
    }
  })

  return NextResponse.json({ date, total, completed, scheduled, absent, byCoach: coachStats })
}
