import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, phone, role, is_active, coach_id, created_at')
    .eq('role', 'member')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  try {
    const { name, phone, coach_id } = await req.json()
    if (!name || !phone) return NextResponse.json({ error: '이름과 전화번호는 필수입니다' }, { status: 400 })

    const tempPin = '123456'
    const pin_hash = await bcrypt.hash(tempPin, 10)

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({ name, phone: phone.replace(/-/g,''), role: 'member', pin_hash, pin_must_change: true, is_active: true, coach_id: coach_id || null })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: '이미 등록된 전화번호입니다' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ...data, temp_pin: tempPin })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
