// src/lib/calcAmount.ts
// ================================================================
// WTA 레슨비 자동 계산 유틸리티
// 순수 계산 함수 + Supabase 연동 재계산 함수
// ================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

// ── 타입 ──────────────────────────────────────────────────────────
export interface WtaConfig {
  session_threshold: number
  sat_surcharge:     number
  sun_surcharge:     number
}

export interface CalcInput {
  config:            WtaConfig
  default_amount:    number
  per_session_price: number
  billing_count:     number
  sat_count:         number
  sun_count:         number
  discount_amount:   number
}

export interface CalcResult {
  base_amount:     number
  sat_count:       number
  sun_count:       number
  sat_extra:       number
  sun_extra:       number
  discount_amount: number
  amount:          number
  pricing_mode:    'monthly' | 'per_session' | 'over'
}

// ── 핵심 계산 함수 (순수, DB 없음) ────────────────────────────────
export function calcAmount(input: CalcInput): CalcResult {
  const {
    config, default_amount, per_session_price,
    billing_count, sat_count, sun_count, discount_amount,
  } = input

  const { session_threshold, sat_surcharge, sun_surcharge } = config

  let base_amount: number
  let pricing_mode: CalcResult['pricing_mode']

  if (billing_count >= session_threshold) {
    const over = billing_count - session_threshold
    base_amount  = default_amount + (over > 0 ? over * per_session_price : 0)
    pricing_mode = over > 0 ? 'over' : 'monthly'
  } else {
    base_amount  = per_session_price * billing_count
    pricing_mode = 'per_session'
  }

  const sat_extra = sat_count > 0 ? sat_surcharge : 0
  const sun_extra = sun_count > 0 ? sun_surcharge : 0
  const amount    = Math.max(0, base_amount + sat_extra + sun_extra - discount_amount)

  return {
    base_amount,
    sat_count,
    sun_count,
    sat_extra,
    sun_extra,
    discount_amount,
    amount,
    pricing_mode,
  }
}

// ── wta_config 조회 ───────────────────────────────────────────────
export async function getConfig(): Promise<WtaConfig> {
  const { data } = await supabaseAdmin
    .from('wta_config')
    .select('session_threshold, sat_surcharge, sun_surcharge')
    .single()

  return data ?? { session_threshold: 8, sat_surcharge: 0, sun_surcharge: 0 }
}

// ── DB 기반 플랜 금액 재계산 + 저장 ──────────────────────────────
export async function recalcAndSavePlan(planId: string): Promise<CalcResult | null> {
  const { data: plan } = await supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, billing_count, total_count, discount_amount,
      program:program_id (
        default_amount, per_session_price
      )
    `)
    .eq('id', planId)
    .single()

  if (!plan) return null

  const prog = (plan as any).program

  // ✅ 핵심 수정: program_id 없으면 금액 계산 건너뜀
  // 수동으로 입력한 금액을 덮어쓰지 않음
  if (!prog) {
    const { data: slots } = await supabaseAdmin
      .from('lesson_slots')
      .select('scheduled_at')
      .eq('lesson_plan_id', planId)
      .eq('status', 'scheduled')
      .eq('is_makeup', false)

    const slotDates = (slots ?? []).map((s: any) => new Date(s.scheduled_at))
    const sat_count = slotDates.filter(d => d.getDay() === 6).length
    const sun_count = slotDates.filter(d => d.getDay() === 0).length

    // sat_count, sun_count만 업데이트 (amount는 건드리지 않음)
    await supabaseAdmin
      .from('lesson_plans')
      .update({ sat_count, sun_count })
      .eq('id', planId)

    return null
  }

  const config = await getConfig()

  const { data: slots } = await supabaseAdmin
    .from('lesson_slots')
    .select('scheduled_at')
    .eq('lesson_plan_id', planId)
    .eq('status', 'scheduled')
    .eq('is_makeup', false)

  const slotDates = (slots ?? []).map((s: any) => new Date(s.scheduled_at))
  const sat_count = slotDates.filter(d => d.getDay() === 6).length
  const sun_count = slotDates.filter(d => d.getDay() === 0).length

  const billing_count = (plan as any).billing_count > 0
    ? (plan as any).billing_count
    : (plan as any).total_count

  const result = calcAmount({
    config,
    default_amount:    prog.default_amount    ?? 0,
    per_session_price: prog.per_session_price ?? 0,
    billing_count,
    sat_count,
    sun_count,
    discount_amount: (plan as any).discount_amount ?? 0,
  })

  await supabaseAdmin
    .from('lesson_plans')
    .update({
      sat_count:  result.sat_count,
      sun_count:  result.sun_count,
      amount:     result.amount,
    })
    .eq('id', planId)

  return result
}
