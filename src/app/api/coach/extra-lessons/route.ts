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
    .select('*, member:lesson_plans(member_id(name, display_name))')
    .eq('added_by_coach', session.userId)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ extras: extras ?? [] })
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = parseSession(cookieStore.get('wta_session')?.value)
  if (!session) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  try {
    const { memberId, extraDate, extraCount, extraAmount, memo } = await request.json()

    const admin = await createAdminClient()
    const monthKey = extraDate.slice(0, 7)

    // 해당 월 lesson_plan 조회
    const { data: plan } = await admin
      .from('lesson_plans')
      .select('id')
      .eq('member_id', memberId)
      .gte('created_at', `${monthKey}-01`)
      .maybeSingle()

    if (!plan) {
      return NextResponse.json({ error: '해당 월의 레슨 플랜이 없습니다.' }, { status: 404 })
    }

    const { error } = await admin.from('extra_lessons').insert({
      lesson_plan_id: plan.id,
      added_by_coach: session.userId,
      extra_date: extraDate,
      extra_count: extraCount,
      extra_amount: extraAmount ?? null,
      memo: memo || null,
      status: 'pending',
    })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('extra lesson error:', e)
    return NextResponse.json({ error: '요청에 실패했습니다.' }, { status: 500 })
  }
}
