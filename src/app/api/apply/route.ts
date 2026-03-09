import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const { name, phone, birth_date, address, emergency_contact, health_notes, desired_schedule } = await req.json()

    if (!name || !name.trim()) return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 })
    if (!phone || !phone.trim()) return NextResponse.json({ error: '전화번호를 입력해주세요' }, { status: 400 })

    const cleanPhone = phone.replace(/-/g, '')

    // 중복 신청 확인
    const { data: existing } = await supabaseAdmin
      .from('member_applications')
      .select('id')
      .eq('phone', cleanPhone)
      .in('status', ['pending', 'approved'])
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: '이미 신청된 전화번호입니다' }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
      .from('member_applications')
      .insert({
        name: name.trim(),
        phone: cleanPhone,
        birth_date: birth_date || null,
        address: address || null,
        emergency_contact: emergency_contact || null,
        health_notes: health_notes || null,
        desired_schedule: desired_schedule || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      // member_applications 테이블이 없을 경우 profiles에 직접 pending 상태로 저장
      if (error.code === '42P01') {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            name: name.trim(),
            phone: cleanPhone,
            role: 'member',
            is_active: false,
          })
        if (profileError) {
          if (profileError.code === '23505') return NextResponse.json({ error: '이미 등록된 전화번호입니다' }, { status: 409 })
          return NextResponse.json({ error: profileError.message }, { status: 500 })
        }
        return NextResponse.json({ ok: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
