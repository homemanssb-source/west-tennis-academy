import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, phone, role, is_active, created_at')
    .in('role', ['admin', 'coach', 'payment'])
    .order('role')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  try {
    const { name, phone, role } = await req.json()
    if (!name || !phone || !role) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    if (!['admin','coach','payment'].includes(role)) return NextResponse.json({ error: '잘못된 역할' }, { status: 400 })

    const tempPin = '123456'
    const pin_hash = await bcrypt.hash(tempPin, 10)

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({ name, phone: phone.replace(/-/g,''), role, pin_hash, pin_must_change: true, is_active: true })
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
