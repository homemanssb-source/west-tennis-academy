// src/lib/calcAmount.ts
// ================================================================
// WTA 레슨비 자동 계산 유틸리티
// 순수 계산 함수 + Supabase 연동 재계산 함수
// ================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

// ── 타입 ──────────────────────────────────────────────────────────
export interface WtaConfig {
  session_threshold: number   // 월정액 기준 횟수 (기본 8)
  sat_surcharge:     number   // 토요일 추가금
  sun_surcharge:     number   // 일요일 추가금
}

export interface CalcInput {
  config:            WtaConfig
  default_amount:    number   // 프로그램 월정액
  per_session_price: number   // 프로그램 회당 단가
  billing_count:     number   // 청구 기준 횟수 (서비스 제외)
  sat_count:         number   // 토요일 수업 횟수
  sun_count:         number   // 일요일 수업 횟수
  discount_amount:   number   // 회원 할인 금액
}

export interface CalcResult {
  base_amount:     number   // 횟수 기준 기본금액 (주말·할인 전)
  sat_extra:       number   // 토요일 추가금
  sun_extra:       number   // 일요일 추가금
  discount_amount: number   // 할인액
  amount:          number   // 최종 결제 금액
  pricing_mode:    'monthly' | 'per_session' | 'over'  // 계산 방식
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
    // 기준 횟수 이상 → 월정액 + 초과분 회당 단가
    const over = billing_count - session_threshold
    base_amount  = default_amount + (over > 0 ? over * per_session_price : 0)
    pricing_mode = over > 0 ? 'over' : 'monthly'
  } else {
    // 기준 횟수 미만 → 회당 단가 × 횟수
    base_amount  = per_session_price * billing_count
    pricing_mode = 'per_session'
  }

  // 주말 추가금 (1회 이상 있으면 고정)
  const sat_extra = sat_count > 0 ? sat_surcharge : 0
  const sun_extra = sun_count > 0 ? sun_surcharge : 0

  // 최종 금액
  const amount = Math.max(0, base_amount + sat_extra + sun_extra - discount_amount)

  return { base_amount, sat_extra, sun_extra, discount_amount, amount, pricing_mode }
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
// 슬롯 상태(scheduled, is_makeup=false) 기준으로 토·일 횟수 집계
// billing_count는 기존 값 유지 (운영자가 수동 설정한 값 존중)
export async function recalcAndSavePlan(planId: string): Promise<CalcResult | null> {
  // 1. 플랜 + 프로그램 정보 조회
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

  // 2. wta_config 조회
  const config = await getConfig()

  // 3. 확정 슬롯(scheduled, 보강 제외)에서 토·일 횟수 집계
  const { data: slots } = await supabaseAdmin
    .from('lesson_slots')
    .select('scheduled_at')
    .eq('lesson_plan_id', planId)
    .eq('status', 'scheduled')
    .eq('is_makeup', false)

  const slotDates = (slots ?? []).map((s: any) => new Date(s.scheduled_at))
  const sat_count = slotDates.filter(d => d.getDay() === 6).length
  const sun_count = slotDates.filter(d => d.getDay() === 0).length

  const prog     = (plan as any).program
  // billing_count: 운영자가 수동 설정한 값 우선, 없으면 total_count
  const billing_count = (plan as any).billing_count > 0
    ? (plan as any).billing_count
    : (plan as any).total_count

  const result = calcAmount({
    config,
    default_amount:    prog?.default_amount    ?? 0,
    per_session_price: prog?.per_session_price ?? 0,
    billing_count,
    sat_count,
    sun_count,
    discount_amount:   (plan as any).discount_amount ?? 0,
  })

  // 4. lesson_plans 업데이트
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
