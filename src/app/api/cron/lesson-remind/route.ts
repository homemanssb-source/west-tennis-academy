import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  // ✅ FIX #2: Cron 인증 추가
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const now  = new Date()
  const kst  = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  const from = new Date(kst.getTime() + 60 * 60 * 1000)
  const to   = new Date(kst.getTime() + 70 * 60 * 1000)

  const fromStr = from.toISOString().replace('Z', '+09:00')
  const toStr   = to.toISOString().replace('Z', '+09:00')

  const { data: slots } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes,
      lesson_plan:lesson_plan_id (
        lesson_type,
        member_id,
        coach:coach_id ( id, name )
      )
    `)
    .eq('status', 'scheduled')
    .gte('scheduled_at', fromStr)
    .lte('scheduled_at', toStr)

  if (!slots || slots.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const inserts = (slots as any[]).flatMap(s => {
    const time = new Date(s.scheduled_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    const lessonType = s.lesson_plan?.lesson_type ?? '수업'
    const coachName  = s.lesson_plan?.coach?.name ?? '코치'
    const memberId   = s.lesson_plan?.member_id
    const coachId    = s.lesson_plan?.coach?.id

    const notifs = []
    if (memberId) {
      notifs.push({
        profile_id: memberId,
        title: `🎾 1시간 후 수업 알림`,
        body: `오늘 ${time} ${lessonType} (${coachName} 코치) 수업이 1시간 후 시작됩니다.`,
        type: 'info',
        link: '/member/schedule',
      })
    }
    if (coachId) {
      notifs.push({
        profile_id: coachId,
        title: `📅 1시간 후 수업 시작`,
        body: `${time} ${lessonType} 수업이 1시간 후 시작됩니다.`,
        type: 'info',
        link: '/coach/schedule',
      })
    }
    return notifs
  })

  if (inserts.length > 0) await supabaseAdmin.from('notifications').insert(inserts)
  return NextResponse.json({ ok: true, sent: inserts.length })
}