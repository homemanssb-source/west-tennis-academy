import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function parseSession(raw: string | undefined) {
  if (!raw) return null
  try {
    const s = JSON.parse(Buffer.from(raw, 'base64').toString())
    if (s.exp < Date.now()) return null
    return s
  } catch { return null }
}

export async function GET() {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const admin = await createAdminClient()
  const monthKey = new Date().toISOString().slice(0, 7)

  const { data: plans } = await admin
    .from('lesson_plans')
    .select(`
      id, payment_status, price, total_lessons, used_lessons,
      member:member_id(id, name, display_name, coach:coach_id(name))
    `)
    .gte('created_at', `${monthKey}-01`)
    .order('payment_status', { ascending: true })

  return NextResponse.json({ plans: plans ?? [] })
}
