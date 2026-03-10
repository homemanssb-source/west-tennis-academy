import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    const { member_id, coach_id, month_id, lesson_type, unit_minutes, schedules, amount, program_id } = await req.json()

    if (!member_id || !coach_id || !month_id || !lesson_type || !schedules?.length) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }

    // ── 중복 시간대 체크 ──────────────────────────────────────
    const datetimes = schedules.map((s: { datetime: string }) => s.datetime)

    const { data: conflicts } = await supabaseAdmin
      .from('lesson_slots')
      .select('scheduled_at, lesson_plans!inner(coach_id)')
      .in('scheduled_at', datetimes)
      .eq('lesson_plans.coach_id', coach_id)
      .neq('status', 'cancelled')

    if (conflicts && conflicts.length > 0) {
      const days = ['일', '월', '화', '수', '목', '금', '토']
      const conflictDates = conflicts.map((c: { scheduled_at: string }) => {
        const d = new Date(c.scheduled_at)
        return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      })
      return NextResponse.json(
        { error: `아래 시간대에 이미 같은 코치의 수업이 있습니다:\n${conflictDates.join('\n')}`, conflicts: conflictDates },
        { status: 409 }
      )
    }

    // ✅ FIX #6: 운영자 스케줄 등록 시 코치 휴무 체크
    for (const s of schedules) {
      const dt        = new Date(s.datetime)
      const dateStr   = dt.toISOString().split('T')[0]
      const hhmm      = dt.toTimeString().slice(0, 5)
      const dayOfWeek = dt.getDay()
      const duration  = s.duration || unit_minutes || 60
      const endDt     = new Date(dt.getTime() + duration * 60 * 1000)
      const endHhmm   = endDt.toTimeString().slice(0, 5)

      const { data: blocks } = await supabaseAdmin
        .from('coach_blocks')
        .select('*')
        .eq('coach_id', coach_id)
        .or(`and(repeat_weekly.eq.false,block_date.eq.${dateStr}),and(repeat_weekly.eq.true,day_of_week.eq.${dayOfWeek})`)

      if (blocks && blocks.length > 0) {
        for (const b of blocks) {
          // 종일 휴무
          if (!b.block_start && !b.block_end) {
            return NextResponse.json(
              { error: `${dateStr} 코치 휴무일입니다.${b.reason ? ' 사유: ' + b.reason : ''}` },
              { status: 409 }
            )
          }
          // 시간대 겹침
          const bStart = b.block_start ?? '00:00'
          const bEnd   = b.block_end   ?? '23:59'
          if (hhmm < bEnd && endHhmm > bStart) {
            return NextResponse.json(
              { error: `${dateStr} ${hhmm} 해당 시간에 코치 휴무가 등록되어 있습니다.${b.reason ? ' 사유: ' + b.reason : ''}` },
              { status: 409 }
            )
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────

    const { data: plan, error: planErr } = await supabaseAdmin
      .from('lesson_plans')
      .insert({
        member_id,
        coach_id,
        month_id,
        lesson_type,
        unit_minutes: unit_minutes || 60,
        total_count: schedules.length,
        completed_count: 0,
        payment_status: 'unpaid',
        amount: amount || 0,
        ...(program_id ? { program_id } : {}),
      })
      .select()
      .single()

    if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })

    const slots = schedules.map((s: { datetime: string; duration: number }) => ({
      lesson_plan_id:   plan.id,
      scheduled_at:     s.datetime,
      duration_minutes: s.duration || unit_minutes || 60,
      status:           'scheduled',
      slot_type:        'lesson',
      is_makeup:        false,
    }))

    const { error: slotsErr } = await supabaseAdmin.from('lesson_slots').insert(slots)

    if (slotsErr) {
      await supabaseAdmin.from('lesson_plans').delete().eq('id', plan.id)
      return NextResponse.json({ error: `슬롯 생성 실패: ${slotsErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, plan_id: plan.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}