// src/app/api/lesson-plans/route.ts
// ✅ fix: 단체수업 max_students 정원 체크 추가
// ✅ fix: 충돌 에러 메시지 KST 기준으로 수정
// ✅ fix: 코치 휴무 체크 KST 기준으로 수정
// ✅ fix: family_member_id 저장 추가
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import { calcAmount, getConfig } from '@/lib/calcAmount'

// ✅ KST 기준 날짜/시간 포맷 (서버용)
function fmtKST(isoStr: string) {
  const d   = new Date(isoStr)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const m  = kst.getUTCMonth() + 1
  const dd = kst.getUTCDate()
  const dow = kst.getUTCDay()
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mm = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${m}/${dd}(${days[dow]}) ${hh}:${mm}`
}

// ✅ KST 기준 날짜 문자열 (YYYY-MM-DD)
function toKSTDateStr(isoStr: string) {
  const d   = new Date(isoStr)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

// ✅ KST 기준 HH:MM
function toKSTHHMM(isoStr: string) {
  const d   = new Date(isoStr)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return `${String(kst.getUTCHours()).padStart(2,'0')}:${String(kst.getUTCMinutes()).padStart(2,'0')}`
}

// ✅ KST 기준 요일 (0=일~6=토)
function toKSTDayOfWeek(isoStr: string) {
  const d   = new Date(isoStr)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.getUTCDay()
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    const {
      member_id, coach_id, month_id, lesson_type,
      unit_minutes, schedules, amount, program_id,
      billing_count: reqBillingCount,
      family_member_id,
    } = await req.json()

    if (!member_id || !coach_id || !month_id || !lesson_type || !schedules?.length) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }

    // ── 프로그램 정원(max_students) 조회 ─────────────────────────────
    let maxStudents = 1
    if (program_id) {
      const { data: prog } = await supabaseAdmin
        .from('lesson_programs')
        .select('max_students')
        .eq('id', program_id)
        .single()
      if (prog?.max_students) maxStudents = prog.max_students
    }

    // ── 중복 시간대 체크 (단체수업 정원 고려) ────────────────────────
    const datetimes = schedules.map((s: { datetime: string }) => s.datetime)

    if (maxStudents <= 1) {
      // 1:1 수업 → 기존대로 하나라도 있으면 충돌
      const { data: conflicts } = await supabaseAdmin
        .from('lesson_slots')
        .select('scheduled_at, lesson_plans!inner(coach_id)')
        .in('scheduled_at', datetimes)
        .eq('lesson_plans.coach_id', coach_id)
        .neq('status', 'cancelled')

      if (conflicts && conflicts.length > 0) {
        const conflictDates = conflicts.map((c: { scheduled_at: string }) => fmtKST(c.scheduled_at))
        return NextResponse.json(
          { error: `아래 시간대에 이미 같은 코치의 수업이 있습니다:\n${conflictDates.join('\n')}`, conflicts: conflictDates },
          { status: 409 }
        )
      }
    } else {
      // ✅ 단체수업 → 시간대별 현재 인원 수 체크
      const overCapacity: string[] = []

      for (const datetime of datetimes) {
        const { data: existing } = await supabaseAdmin
          .from('lesson_slots')
          .select('id, lesson_plans!inner(coach_id, program_id)')
          .eq('scheduled_at', datetime)
          .eq('lesson_plans.coach_id', coach_id)
          .neq('status', 'cancelled')

        const currentCount = (existing ?? []).length

        if (currentCount >= maxStudents) {
          overCapacity.push(`${fmtKST(datetime)} (${currentCount}/${maxStudents}명 정원 초과)`)
        }
      }

      if (overCapacity.length > 0) {
        return NextResponse.json(
          { error: `아래 시간대가 정원을 초과했습니다:\n${overCapacity.join('\n')}`, conflicts: overCapacity },
          { status: 409 }
        )
      }
    }

    // ── 코치 휴무 체크 (KST 기준으로 수정) ──────────────────────────
    for (const s of schedules) {
      const dateStr   = toKSTDateStr(s.datetime)   // ✅ KST 날짜
      const hhmm      = toKSTHHMM(s.datetime)       // ✅ KST 시간
      const dayOfWeek = toKSTDayOfWeek(s.datetime)  // ✅ KST 요일
      const duration  = s.duration || unit_minutes || 60
      const endDt     = new Date(new Date(s.datetime).getTime() + duration * 60 * 1000)
      const endHhmm   = toKSTHHMM(endDt.toISOString())

      const { data: blocks } = await supabaseAdmin
        .from('coach_blocks')
        .select('*')
        .eq('coach_id', coach_id)
        .or(`and(repeat_weekly.eq.false,block_date.eq.${dateStr}),and(repeat_weekly.eq.true,day_of_week.eq.${dayOfWeek})`)

      if (blocks && blocks.length > 0) {
        for (const b of blocks) {
          if (!b.block_start && !b.block_end) {
            return NextResponse.json(
              { error: `${dateStr} 코치 휴무일입니다.${b.reason ? ' 사유: ' + b.reason : ''}` },
              { status: 409 }
            )
          }
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

    // ── 레슨비 자동 계산 ──────────────────────────────────────────────
    const billing_count = reqBillingCount ?? schedules.length

    // ✅ KST 기준 토·일 횟수 집계
    const sat_count = schedules.filter((s: { datetime: string }) => toKSTDayOfWeek(s.datetime) === 6).length
    const sun_count = schedules.filter((s: { datetime: string }) => toKSTDayOfWeek(s.datetime) === 0).length

    let finalAmount    = amount || 0
    let discount_amount = 0
    let discount_memo: string | null = null

    if (program_id) {
      const [progRes, configRes, memberRes] = await Promise.all([
        supabaseAdmin.from('lesson_programs').select('default_amount, per_session_price').eq('id', program_id).single(),
        getConfig(),
        supabaseAdmin.from('profiles').select('discount_amount, discount_memo').eq('id', member_id).single(),
      ])

      const prog   = progRes.data
      const config = configRes
      const member = memberRes.data

      discount_amount = member?.discount_amount ?? 0
      discount_memo   = member?.discount_memo   ?? null

      if (prog) {
        const calc = calcAmount({
          config,
          default_amount:    prog.default_amount    ?? 0,
          per_session_price: prog.per_session_price ?? 0,
          billing_count,
          sat_count,
          sun_count,
          discount_amount,
        })
        finalAmount = calc.amount
      }
    }

    // ── lesson_plans insert ───────────────────────────────────────────
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('lesson_plans')
      .insert({
        member_id,
        coach_id,
        month_id,
        lesson_type,
        unit_minutes:    unit_minutes || 60,
        total_count:     schedules.length,
        billing_count,
        completed_count: 0,
        payment_status:  'unpaid',
        amount:          finalAmount,
        sat_count,
        sun_count,
        discount_amount,
        discount_memo,
        ...(program_id       ? { program_id }       : {}),
        ...(family_member_id ? { family_member_id } : {}),
      })
      .select()
      .single()

    if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })

    // ── lesson_slots insert ───────────────────────────────────────────
    const slotsToInsert = schedules.map((s: { datetime: string; duration: number }) => ({
      lesson_plan_id:   plan.id,
      scheduled_at:     s.datetime,
      duration_minutes: s.duration || unit_minutes || 60,
      status:           'scheduled',
      slot_type:        'lesson',
      is_makeup:        false,
    }))

    const { error: slotsErr } = await supabaseAdmin.from('lesson_slots').insert(slotsToInsert)

    if (slotsErr) {
      await supabaseAdmin.from('lesson_plans').delete().eq('id', plan.id)
      return NextResponse.json({ error: `슬롯 생성 실패: ${slotsErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, plan_id: plan.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}