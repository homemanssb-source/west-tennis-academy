import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { current_pin, new_pin } = await req.json()
  if (!new_pin || new_pin.length !== 6) return NextResponse.json({ error: 'PIN은 6자리여야 합니다' }, { status: 400 })

  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('pin_hash, pin_must_change')
    .eq('id', session.id)
    .single()

  if (!user) return NextResponse.json({ error: '사용자 없음' }, { status: 404 })

  // 강제변경 아닌 경우 현재 PIN 확인
  if (!user.pin_must_change) {
    const ok = await bcrypt.compare(current_pin, user.pin_hash)
    if (!ok) return NextResponse.json({ error: '현재 PIN이 올바르지 않습니다' }, { status: 401 })
  }

  const pin_hash = await bcrypt.hash(new_pin, 10)
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ pin_hash, pin_must_change: false })
    .eq('id', session.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
