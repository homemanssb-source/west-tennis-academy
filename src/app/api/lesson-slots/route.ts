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

  // pending 신청도 포함 (정원 카운트에 반영)
  const { data: appData } = await supabaseAdmin
    .from('lesson_applications')
    .select('id, requested_at, status, coach_id')
    .eq('coach_id', coachId ?? '')
    .gte('requested_at', startStr)
    .lte('requested_at', endStr)
    .in('status', ['pending_coach', 'pending_admin', 'approved'])

  const appSlots = (appData ?? []).map((a: any) => ({
    id: a.id,
    scheduled_at: a.requested_at,
    status: a.status,
    duration_minutes: 60,
    slot_type: null,
    lesson_plan: null,
  }))

  // ✅ 추가: 시간대별 슬롯 카운트 맵 생성
  // → isBusy에서 "몇 명이 있는지"를 알 수 있도록
  // 형식: { "2026-03-16T09:00": 2, ... }
  const allSlots = [...filtered, ...appSlots]
  const countMap: Record<string, number> = {}
  allSlots.forEach((s: any) => {
    if (s.status === 'cancelled') return
    const key = s.scheduled_at?.slice(0, 16) // "2026-03-16T09:00"
    if (key) countMap[key] = (countMap[key] ?? 0) + 1
  })

  // 각 슬롯에 slot_count 필드 추가
  const result = allSlots.map((s: any) => ({
    ...s,
    slot_count: s.status !== 'cancelled'
      ? (countMap[s.scheduled_at?.slice(0, 16)] ?? 1)
      : 0,
  }))

  return NextResponse.json(result)
}