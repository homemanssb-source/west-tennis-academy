// src/app/api/lesson-slots/route.ts
// ✅ fix: POST 핸들러 추가 (슬롯 추가 기능)
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
    .not('status', 'in', '("draft","cancelled")')
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filtered = coachId
    ? data.filter((s: any) => s.lesson_plan?.coach?.id === coachId)
    : data

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
    }))
  }

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

// ✅ 추가: POST — 운영자/어드민이 수업 슬롯 직접 추가
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    const { lesson_plan_id, scheduled_at, duration_minutes, status } = await req.json()

    if (!lesson_plan_id || !scheduled_at) {
      return NextResponse.json({ error: 'lesson_plan_id, scheduled_at 필수' }, { status: 400 })
    }

    const { data: plan, error: planErr } = await supabaseAdmin
      .from('lesson_plans')
      .select('id, total_count')
      .eq('id', lesson_plan_id)
      .single()

    if (planErr || !plan) {
      return NextResponse.json({ error: '존재하지 않는 레슨 플랜입니다' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('lesson_slots')
      .insert({
        lesson_plan_id,
        scheduled_at,
        duration_minutes: duration_minutes ?? 60,
        status: status ?? 'scheduled',
        slot_type: 'regular',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // scheduled 상태로 추가 시 total_count 증가
    if (!status || status === 'scheduled') {
      await supabaseAdmin
        .from('lesson_plans')
        .update({ total_count: (plan.total_count ?? 0) + 1 })
        .eq('id', lesson_plan_id)
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}