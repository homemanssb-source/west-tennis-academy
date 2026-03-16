// src/app/api/cron/auto-complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ✅ CRON_SECRET 인증
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

  // KST 기준 현재 시각
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  // ✅ 개선 포인트:
  //  - 기존: "어제 하루 전체"를 다음날 새벽에 일괄 처리
  //  - 변경: "오늘 자정(23:59) cron 실행 시" 당일 종료된 수업 전부 처리
  //
  // 로직:
  //  1) 오늘 KST 00:00 ~ 현재 시각 사이에 시작한 scheduled 슬롯 조회
  //  2) JS에서 scheduled_at + duration_minutes <= 현재 시각 인 것만 필터
  //     → 실제로 수업이 끝난 슬롯만 완료 처리

  const todayStr  = kst.toISOString().split('T')[0]           // "2026-03-16"
  const dayStart  = `${todayStr}T00:00:00+09:00`              // 오늘 KST 0시
  const nowKstStr = kst.toISOString().replace('Z', '+09:00')  // 현재 KST 시각

  // 오늘 시작한 scheduled 슬롯 전부 조회
  const { data: slots, error } = await supabaseAdmin
    .from('lesson_slots')
    .select('id, lesson_plan_id, scheduled_at, duration_minutes')
    .eq('status', 'scheduled')
    .gte('scheduled_at', dayStart)
    .lte('scheduled_at', nowKstStr)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!slots || slots.length === 0) return NextResponse.json({ ok: true, updated: 0 })

  // ✅ 핵심 필터: 시작 시각 + 수업 길이 <= 현재 시각 → 수업이 실제로 끝난 것만
  const nowMs = now.getTime()
  const finished = slots.filter(s => {
    const startMs    = new Date(s.scheduled_at).getTime()
    const durationMs = (s.duration_minutes ?? 60) * 60 * 1000
    return startMs + durationMs <= nowMs
  })

  if (finished.length === 0) return NextResponse.json({ ok: true, updated: 0 })

  const ids = finished.map(s => s.id)

  // completed 상태로 업데이트 + auto_completed 플래그
  await supabaseAdmin
    .from('lesson_slots')
    .update({ status: 'completed', auto_completed: true })
    .in('id', ids)

  // lesson_plans completed_count 업데이트
  const planMap: Record<string, number> = {}
  finished.forEach(s => {
    planMap[s.lesson_plan_id] = (planMap[s.lesson_plan_id] ?? 0) + 1
  })

  for (const [planId, cnt] of Object.entries(planMap)) {
    const { data: plan } = await supabaseAdmin
      .from('lesson_plans')
      .select('completed_count')
      .eq('id', planId)
      .single()
    if (plan) {
      await supabaseAdmin
        .from('lesson_plans')
        .update({ completed_count: plan.completed_count + cnt })
        .eq('id', planId)
    }
  }

  return NextResponse.json({ ok: true, updated: finished.length })
}