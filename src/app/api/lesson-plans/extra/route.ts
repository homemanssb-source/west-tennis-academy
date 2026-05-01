import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin', 'payment'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const {
    member_id, coach_id, month_id, lesson_type, unit_minutes, scheduled_at, amount,
    program_id, family_member_id,
  } = await req.json()

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

  // ── 정원/중복 시간대 체크 ─────────────────────────────────
  // program_id 가 있으면 program 의 max_students 까지 그룹 등록 허용
  let maxStudents = 1
  if (program_id) {
    const { data: prog } = await supabaseAdmin
      .from('lesson_programs')
      .select('max_students')
      .eq('id', program_id)
      .single()
    if (prog?.max_students) maxStudents = prog.max_students
  }

  const { data: existing } = await supabaseAdmin
    .from('lesson_slots')
    .select('id, lesson_plans!inner(coach_id, program_id)')
    .eq('scheduled_at', scheduled_at)
    .eq('lesson_plans.coach_id', coach_id)
    .neq('status', 'cancelled')

  // 같은 program 의 슬롯만 정원 카운트 / program_id 없으면 코치 기준
  const matching = program_id
    ? (existing ?? []).filter((s: any) => (s.lesson_plans as any)?.program_id === program_id)
    : (existing ?? [])

  if (matching.length >= maxStudents) {
    const reason = maxStudents === 1
      ? `${fmtKST(scheduled_at)} 시간대에 이미 같은 코치의 수업이 있습니다`
      : `${fmtKST(scheduled_at)} 정원 초과 (${matching.length}/${maxStudents}명)`
    return NextResponse.json({ error: reason }, { status: 409 })
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
      ...(program_id       ? { program_id }       : {}),
      ...(family_member_id ? { family_member_id } : {}),
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