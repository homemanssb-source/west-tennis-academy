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

  const { data: requests } = await admin
    .from('makeup_requests')
    .select(`
      *,
      member:member_id(name, display_name),
      original_slot:original_slot_id(scheduled_at)
    `)
    .eq('coach_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(30)

  return NextResponse.json({ requests: requests ?? [] })
}
