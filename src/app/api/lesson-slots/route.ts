// src/app/api/lesson-slots/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const date    = searchParams.get('date')
  const from    = searchParams.get('from')
  const to      = searchParams.get('to')
  const coachId = searchParams.get('coach_id')

  if (!date && (!from || !to)) {
    return NextResponse.json({ error: 'date 또는 from+to 파라미터 필요' }, { status: 400 })
  }

  let startStr: string
  let endStr:   string

  if (date) {
    startStr = `${date}T00:00:00+09:00`
    endStr   = `${date}T23:59:59+09:00`
  } else {
    startStr = `${from}T00:00:00+09:00`
    endStr   = `${to}T23:59:59+09:00`
  }

  const { data, error } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, status, slot_type, is_makeup, memo,
      lesson_plan:lesson_plan_id (
        id, lesson_type, unit_minutes,
        member:member_id ( id, name, phone ),
        coach:coach_id ( id, name )
      )
    `)
    .gte('scheduled_at', startStr)
    .lte('scheduled_at', endStr)
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filtered = coachId
    ? data.filter((s: any) => s.lesson_plan?.coach?.id === coachId)
    : data

  // ✅ 수정: coachId 없을 때 appSlots 조회 생략 ('' 로 쿼리하던 버그 제거)
  let appSlots: any[] = []
  if (coachId) {
    const { data: appData } = await supabaseAdmin
      .from('lesson_applications')
      .select('id, requested_at, status, coach_id')
      .eq('coach_id', coachId)
      .gte('requested_at', startStr)
      .lte('requested_at', endStr)
      .in('status', ['pending_coach', 'pending_admin', 'approved'])

    appSlots = (appData ?? []).map((a: any) => ({
      id: a.id,
      scheduled_at: a.requested_at,
      status: a.status,
      duration_minutes: 60,
      slot_type: null,
      lesson_plan: null,
      slot_count: 1,
    }))
  }

  // ✅ 추가: 시간대별 카운트 맵 (isBusy 정원 체크용)
  const allSlots = [...filtered, ...appSlots]
  const countMap: Record<string, number> = {}
  allSlots.forEach((s: any) => {
    if (s.status === 'cancelled') return
    const key = s.scheduled_at?.slice(0, 16)
    if (key) countMap[key] = (countMap[key] ?? 0) + 1
  })

  const result = allSlots.map((s: any) => ({
    ...s,
    slot_count: s.status !== 'cancelled'
      ? (countMap[s.scheduled_at?.slice(0, 16)] ?? 1)
      : 0,
  }))

  return NextResponse.json(result)
}