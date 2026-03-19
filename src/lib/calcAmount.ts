// src/lib/calcAmount.ts
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface WtaConfig {
  session_threshold: number
  sat_surcharge:     number
  sun_surcharge:     number
}

export interface CalcInput {
  config:             WtaConfig
  default_amount:     number
  per_session_price:  number
  billing_count:      number
  sat_count:          number
  sun_count:          number
  discount_amount:    number
  is_coach_program?:  boolean  // ✅ 추가: 코치 지정 프로그램 여부
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

export function calcAmount(input: CalcInput): CalcResult {
  const {
    config, default_amount, per_session_price,
    billing_count, sat_count, sun_count, discount_amount,
    is_coach_program = false,
  } = input

  const { session_threshold, sat_surcharge, sun_surcharge } = config

  let base_amount: number
  let pricing_mode: CalcResult['pricing_mode']

  if (billing_count >= session_threshold) {
    if (is_coach_program) {
      // ✅ 코치 지정: 8회 이상이면 무조건 월정액 고정
      base_amount  = default_amount
      pricing_mode = 'monthly'
    } else {
      // ✅ 공통: 8회 이상이면 월정액 + 초과분
      const over   = billing_count - session_threshold
      base_amount  = default_amount + (over > 0 ? over * per_session_price : 0)
      pricing_mode = over > 0 ? 'over' : 'monthly'
    }
  } else {
    base_amount  = per_session_price * billing_count
    pricing_mode = 'per_session'
  }

  const sat_extra = sat_count > 0 ? sat_surcharge : 0
  const sun_extra = sun_count > 0 ? sun_surcharge : 0
  const amount    = Math.max(0, base_amount + sat_extra + sun_extra - discount_amount)

  return { base_amount, sat_count, sun_count, sat_extra, sun_extra, discount_amount, amount, pricing_mode }
}

export async function getConfig(): Promise<WtaConfig> {
  const { data } = await supabaseAdmin
    .from('wta_config')
    .select('session_threshold, sat_surcharge, sun_surcharge')
    .single()
  return data ?? { session_threshold: 8, sat_surcharge: 0, sun_surcharge: 0 }
}

export async function recalcAndSavePlan(planId: string): Promise<CalcResult | null> {
  const { data: plan } = await supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, billing_count, total_count, discount_amount,
      program:program_id (
        default_amount, per_session_price, coach_id
      )
    `)
    .eq('id', planId)
    .single()

  if (!plan) return null

  const prog = (plan as any).program

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
    await supabaseAdmin.from('lesson_plans').update({ sat_count, sun_count }).eq('id', planId)
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
    discount_amount:   (plan as any).discount_amount ?? 0,
    is_coach_program:  !!prog.coach_id,  // ✅ 추가
  })

  await supabaseAdmin
    .from('lesson_plans')
    .update({ sat_count: result.sat_count, sun_count: result.sun_count, amount: result.amount })
    .eq('id', planId)

  return result
}