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
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { requestId, action, responseReason } = await request.json()
    const admin = await createAdminClient()
    await admin.from('makeup_requests').update({
      status: action === 'approve' ? 'approved' : 'rejected',
      response_reason: responseReason ?? null,
      responded_at: new Date().toISOString(),
    }).eq('id', requestId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 })
  }
}
