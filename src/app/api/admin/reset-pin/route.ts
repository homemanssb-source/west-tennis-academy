import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function parseSession(raw: string | undefined) {
  if (!raw) return null
  try {
    const s = JSON.parse(Buffer.from(raw, 'base64').toString())
    if (s.exp < Date.now()) return null
    return s
  } catch { return null }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  try {
    const { memberId, pin } = await request.json()
    if (!pin || pin.length !== 6) return NextResponse.json({ error: 'PIN 6자리를 입력해 주세요.' }, { status: 400 })

    const admin = await createAdminClient()
    const { error } = await admin.from('profiles').update({ pin_code: pin }).eq('id', memberId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'PIN 초기화에 실패했습니다.' }, { status: 500 })
  }
}
