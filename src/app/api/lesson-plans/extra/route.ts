import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin', 'payment'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { member_id, coach_id, month_id, lesson_type, unit_minutes, scheduled_at, amount } = await req.json()

  if (!member_id || !coach_id || !month_id || !scheduled_at) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  const { data: plan, error: planErr } = await supabaseAdmin
    .from('lesson_plans')
    .insert({
      member_id,
      coach_id,
      month_id,
      lesson_type: lesson_type || '추가수업',
      unit_minutes: unit_minutes || 60,
      total_count: 1,
      completed_count: 0,
      payment_status: 'unpaid',
      amount: amount || 0,
    })
    .select()
    .single()

  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })

  const { error: slotErr } = await supabaseAdmin
    .from('lesson_slots')
    .insert({
      lesson_plan_id: plan.id,
      scheduled_at,
      duration_minutes: unit_minutes || 60,
      status: 'scheduled',
      is_makeup: false,
      slot_type: 'lesson',
    })

  if (slotErr) return NextResponse.json({ error: slotErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, plan_id: plan.id })
}
