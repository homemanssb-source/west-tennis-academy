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

  // ✅ KST 기준 에러 메시지용 시간 포맷 함수
  const fmtKST = (isoStr: string) => {
    const d = new Date(isoStr)
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}(${days[kst.getUTCDay()]}) ${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`
  }

  // ── 중복 시간대 체크 ──────────────────────────────────────
  // ✅ scheduled_at이 +09:00 형식이므로 DB와 정확히 비교됨
  const { data: conflicts } = await supabaseAdmin
    .from('lesson_slots')
    .select('scheduled_at, lesson_plans!inner(coach_id)')
    .eq('scheduled_at', scheduled_at)
    .eq('lesson_plans.coach_id', coach_id)
    .neq('status', 'cancelled')

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: `${fmtKST(scheduled_at)} 시간대에 이미 같은 코치의 수업이 있습니다` },
      { status: 409 }
    )
  }

  // ── 코치 휴무 체크 ────────────────────────────────────────
  const dt        = new Date(scheduled_at)
  const kst       = new Date(dt.getTime() + 9 * 60 * 60 * 1000)
  const dateStr   = kst.toISOString().split('T')[0]           // KST 날짜
  const hhmm      = `${String(kst.getUTCHours()).padStart(2,'0')}:${String(kst.getUTCMinutes()).padStart(2,'0')}`
  const dayOfWeek = kst.getUTCDay()
  const duration  = unit_minutes || 60
  const endKst    = new Date(kst.getTime() + duration * 60 * 1000)
  const endHhmm   = `${String(endKst.getUTCHours()).padStart(2,'0')}:${String(endKst.getUTCMinutes()).padStart(2,'0')}`

  const { data: blocks } = await supabaseAdmin
    .from('coach_blocks')
    .select('*')
    .eq('coach_id', coach_id)
    .or(`and(repeat_weekly.eq.false,block_date.eq.${dateStr}),and(repeat_weekly.eq.true,day_of_week.eq.${dayOfWeek})`)

  if (blocks && blocks.length > 0) {
    for (const b of blocks) {
      if (!b.block_start && !b.block_end) {
        return NextResponse.json(
          { error: `${fmtKST(scheduled_at)} 코치 휴무일입니다.${b.reason ? ' 사유: ' + b.reason : ''}` },
          { status: 409 }
        )
      }
      const bStart = b.block_start ?? '00:00'
      const bEnd   = b.block_end   ?? '23:59'
      if (hhmm < bEnd && endHhmm > bStart) {
        return NextResponse.json(
          { error: `${fmtKST(scheduled_at)} 코치 휴무 시간입니다.${b.reason ? ' 사유: ' + b.reason : ''}` },
          { status: 409 }
        )
      }
    }
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