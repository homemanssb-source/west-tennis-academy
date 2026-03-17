import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function verifyCronSecret(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return authHeader === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  // ✅ 수정: dayStart 조건 제거 — 현재 시각 이전의 scheduled 슬롯 전체 처리
  // (기존: 오늘 00:00 이후만 → 자정 실행 시 처리 대상 0개 버그)
  const nowKstStr = kst.toISOString().replace('Z', '+09:00')

  const { data: slots, error } = await supabaseAdmin
    .from('lesson_slots')
    .select('id, lesson_plan_id, scheduled_at, duration_minutes')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowKstStr)  // 현재 시각 이전 전체 (당일 제한 없음)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!slots || slots.length === 0) return NextResponse.json({ ok: true, updated: 0 })

  // 실제 종료된 슬롯만 필터 (시작시간 + 수업시간 <= 현재)
  const nowMs = now.getTime()
  const finished = slots.filter(s => {
    const startMs    = new Date(s.scheduled_at).getTime()
    const durationMs = (s.duration_minutes ?? 60) * 60 * 1000
    return startMs + durationMs <= nowMs
  })

  if (finished.length === 0) return NextResponse.json({ ok: true, updated: 0 })

  const ids = finished.map(s => s.id)

  // 상태 업데이트
  await supabaseAdmin
    .from('lesson_slots')
    .update({ status: 'completed', auto_completed: true })
    .in('id', ids)

  // plan별 completed_count 증가 (RPC)
  const planMap: Record<string, number> = {}
  finished.forEach(s => {
    planMap[s.lesson_plan_id] = (planMap[s.lesson_plan_id] ?? 0) + 1
  })

  await Promise.all(
    Object.entries(planMap).map(([planId, cnt]) =>
      supabaseAdmin.rpc('increment_completed_by', { plan_id: planId, amount: cnt })
    )
  )

  return NextResponse.json({ ok: true, updated: finished.length })
}