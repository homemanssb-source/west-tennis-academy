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

export async function GET() {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: terms } = await admin
    .from('terms_versions')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json({ terms: terms ?? [] })
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  try {
    const { content, version, memo } = await request.json()
    const admin = await createAdminClient()

    const { error } = await admin.from('terms_versions').insert({
      content, version, memo: memo ?? null,
      created_by: session.userId,
      is_current: false,
    })
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  try {
    const { id } = await request.json()
    const admin = await createAdminClient()

    // 모두 false → 선택만 true
    await admin.from('terms_versions').update({ is_current: false }).neq('id', id)
    await admin.from('terms_versions').update({ is_current: true }).eq('id', id)

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: '현행 설정에 실패했습니다.' }, { status: 500 })
  }
}
