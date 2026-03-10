import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  // ✅ FIX #2: Cron 인증 추가
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  // KST 기준 어제 날짜
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  kst.setDate(kst.getDate() - 1)
  const yesterday = kst.toISOString().split('T')[0]

  const start = `${yesterday}T00:00:00+09:00`
  const end   = `${yesterday}T23:59:59+09:00`

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

  // ✅ FIX #8: Race condition → RPC atomic increment 사용
  const planMap: Record<string, number> = {}
  slots.forEach(s => { planMap[s.lesson_plan_id] = (planMap[s.lesson_plan_id] ?? 0) + 1 })

  for (const [planId, cnt] of Object.entries(planMap)) {
    await supabaseAdmin.rpc('increment_completed_by', { plan_id: planId, amount: cnt })
  }

  return NextResponse.json({ ok: true, updated: ids.length })
}