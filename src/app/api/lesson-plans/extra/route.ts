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

  // ── 중복 시간대 체크 ──────────────────────────────────────
  const { data: conflicts } = await supabaseAdmin
    .from('lesson_slots')
    .select('scheduled_at, lesson_plans!inner(coach_id)')
    .eq('scheduled_at', scheduled_at)
    .eq('lesson_plans.coach_id', coach_id)
    .neq('status', 'cancelled')

  if (conflicts && conflicts.length > 0) {
    const d = new Date(scheduled_at)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const timeStr = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return NextResponse.json(
      { error: `${timeStr} 시간대에 이미 같은 코치의 수업이 있습니다` },
      { status: 409 }
    )
  }
  // ─────────────────────────────────────────────────────────

  // 레슨 플랜 생성
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

  // 슬롯 생성 — 실패 시 plan 롤백
  const { error: slotErr } = await supabaseAdmin
    .from('lesson_slots')
    .insert({
      lesson_plan_id:   plan.id,
      scheduled_at,
      duration_minutes: unit_minutes || 60,
      status:           'scheduled',
      is_makeup:        false,
      slot_type:        'lesson',
    })

  if (slotErr) {
    await supabaseAdmin.from('lesson_plans').delete().eq('id', plan.id)
    return NextResponse.json({ error: `슬롯 생성 실패: ${slotErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, plan_id: plan.id })
}
