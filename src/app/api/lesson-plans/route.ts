import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    const { member_id, coach_id, month_id, lesson_type, unit_minutes, schedules, amount } = await req.json()

    if (!member_id || !coach_id || !month_id || !lesson_type || !schedules?.length) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }

    // 레슨 플랜 생성
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('lesson_plans')
      .insert({
        member_id, coach_id, month_id, lesson_type,
        unit_minutes: unit_minutes || 60,
        total_count: schedules.length,
        completed_count: 0,
        payment_status: 'unpaid',
        amount: amount || 0,
      })
      .select()
      .single()

    if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })

    // 슬롯 생성
    const slots = schedules.map((s: { datetime: string; duration: number }) => ({
      lesson_plan_id:  plan.id,
      scheduled_at:    s.datetime,
      duration_minutes: s.duration || unit_minutes || 60,
      status:          'scheduled',
      slot_type:       'lesson',
      is_makeup:       false,
    }))

    const { error: slotsErr } = await supabaseAdmin.from('lesson_slots').insert(slots)
    if (slotsErr) return NextResponse.json({ error: slotsErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, plan_id: plan.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
