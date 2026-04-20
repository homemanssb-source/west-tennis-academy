import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { RL, checkRate } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  try {
    const blocked = await checkRate(RL.apply, req)
    if (blocked) return blocked

    const {
      name, phone, birth_date, address,
      emergency_contact, health_notes, desired_schedule,
      pin,  // 회원이 직접 설정한 PIN
    } = await req.json()

    if (!name || !name.trim()) return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 })
    if (!phone || !phone.trim()) return NextResponse.json({ error: '전화번호를 입력해주세요' }, { status: 400 })
    if (!pin || !/^\d{6}$/.test(pin)) return NextResponse.json({ error: 'PIN은 숫자 6자리입니다' }, { status: 400 })

    const cleanPhone = phone.replace(/-/g, '')

    // 중복 전화번호 확인 (profiles)
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '이미 등록된 전화번호입니다' }, { status: 409 })
    }

    // PIN 해시
    const bcrypt = await import('bcryptjs')
    const pin_hash = await bcrypt.hash(pin, 10)

    // profiles에 즉시 등록 (승인 절차 없이)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        name:       name.trim(),
        phone:      cleanPhone,
        role:       'member',
        pin_hash,
        pin_must_change: false,   // 본인이 직접 설정했으므로 변경 불필요
        is_active:  true,
        is_owner:   false,
      })

    if (profileError) {
      if (profileError.code === '23505') {
        return NextResponse.json({ error: '이미 등록된 전화번호입니다' }, { status: 409 })
      }
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // member_applications에도 기록 (운영자가 가입 현황 파악용)
    await supabaseAdmin
      .from('member_applications')
      .insert({
        name:               name.trim(),
        phone:              cleanPhone,
        birth_date:         birth_date || null,
        address:            address || null,
        emergency_contact:  emergency_contact || null,
        health_notes:       health_notes || null,
        desired_schedule:   desired_schedule || null,
        status:             'approved',   // 즉시 승인 처리
      })
      .select()
      // 실패해도 가입 자체는 성공 처리 (무시)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}