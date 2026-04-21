// src/app/api/slots-by-person/route.ts
// 특정 profile(회원 or 코치)의 지정 월 슬롯 전체 조회
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const profileId = req.nextUrl.searchParams.get('profile_id')
  const monthId   = req.nextUrl.searchParams.get('month_id')
  if (!profileId || !monthId) {
    return NextResponse.json({ error: 'profile_id, month_id 필요' }, { status: 400 })
  }

  // profile role 확인
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, name, role')
    .eq('id', profileId)
    .single()
  if (!profile) return NextResponse.json({ error: '사용자 없음' }, { status: 404 })

  // 해당 월의 관련 plan 조회
  let planQ = supabaseAdmin
    .from('lesson_plans')
    .select('id, member_id, coach_id, lesson_type, amount, total_count, payment_status, family_member_id')
    .eq('month_id', monthId)

  if (profile.role === 'coach') planQ = planQ.eq('coach_id', profileId)
  else planQ = planQ.eq('member_id', profileId)

  const { data: plans } = await planQ
  if (!plans || plans.length === 0) {
    return NextResponse.json({ profile, plans: [], slots: [] })
  }

  const planIds = plans.map(p => p.id)

  // 슬롯 조회 (draft + scheduled + completed + absent 등 모두 포함)
  const { data: slots, error } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, status, is_makeup, has_conflict, lesson_plan_id,
      lesson_plan:lesson_plan_id (
        id, lesson_type,
        member:member_id ( id, name ),
        coach:coach_id ( id, name ),
        family_member:family_member_id ( id, name )
      )
    `)
    .in('lesson_plan_id', planIds)
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = (slots ?? []).map((s: any) => ({
    ...s,
    family_member_name: s.lesson_plan?.family_member?.name ?? null,
  }))

  return NextResponse.json({ profile, plans, slots: enriched })
}
