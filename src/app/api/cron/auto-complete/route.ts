import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  // KST 기준 어제 날짜
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  kst.setDate(kst.getDate() - 1)
  const yesterday = kst.toISOString().split('T')[0]

  const start = `${yesterday}T00:00:00+09:00`
  const end   = `${yesterday}T23:59:59+09:00`

  // 어제 scheduled 상태인 슬롯 자동 완료 처리
  const { data: slots, error } = await supabaseAdmin
    .from('lesson_slots')
    .select('id, lesson_plan_id')
    .eq('status', 'scheduled')
    .gte('scheduled_at', start)
    .lte('scheduled_at', end)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!slots || slots.length === 0) return NextResponse.json({ ok: true, updated: 0 })

  const ids = slots.map(s => s.id)
  await supabaseAdmin
    .from('lesson_slots')
    .update({ status: 'completed', auto_completed: true })
    .in('id', ids)

  // completed_count 업데이트
  const planMap: Record<string, number> = {}
  slots.forEach(s => { planMap[s.lesson_plan_id] = (planMap[s.lesson_plan_id] ?? 0) + 1 })

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

  return NextResponse.json({ ok: true, updated: ids.length })
}
