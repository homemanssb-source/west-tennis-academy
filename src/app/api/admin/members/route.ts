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
  const { data: members } = await admin
    .from('profiles')
    .select('id, name, phone, role, is_active, parent_id, is_primary, coach_id, coach:coach_id(name)')
    .order('role', { ascending: true })
    .order('name', { ascending: true })

  return NextResponse.json({
    members: members?.map(m => ({
      ...m,
      coach_name: (m.coach as any)?.name ?? null,
    })) ?? []
  })
}

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session || session.role !== 'admin') return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })

  try {
    const body = await request.json()
    const { memberId, role, is_active } = body

    const admin = await createAdminClient()
    const updates: any = {}
    if (role !== undefined) updates.role = role
    if (is_active !== undefined) updates.is_active = is_active

    const { error } = await admin.from('profiles').update(updates).eq('id', memberId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: '수정에 실패했습니다.' }, { status: 500 })
  }
}
