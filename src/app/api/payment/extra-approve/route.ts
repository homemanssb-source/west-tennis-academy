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
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  const admin = await createAdminClient()
  const { data: extras } = await admin
    .from('extra_lessons')
    .select(`
      *,
      member:lesson_plans(member_id(name, display_name)),
      coach:added_by_coach(name)
    `)
    .order('created_at', { ascending: false })
    .limit(30)

  return NextResponse.json({ extras: extras ?? [] })
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  try {
    const { extraId, action, reason } = await request.json()
    const admin = await createAdminClient()

    if (action === 'confirm') {
      const { data: extra } = await admin
        .from('extra_lessons')
        .select('lesson_plan_id, extra_count')
        .eq('id', extraId)
        .single()

      if (!extra) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 })

      // 수업 추가 확정 + lesson_plan extra_lessons 증가
      await admin.from('extra_lessons').update({
        status: 'confirmed',
        confirmed_by: session.userId,
      }).eq('id', extraId)

      await admin.rpc('increment_extra_lessons', {
        plan_id: extra.lesson_plan_id,
        count: extra.extra_count,
      })

    } else {
      await admin.from('extra_lessons').update({
        status: 'rejected',
        memo: reason ?? null,
      }).eq('id', extraId)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('extra approve error:', e)
    return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 })
  }
}
