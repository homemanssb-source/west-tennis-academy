import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { from_month_id, to_month_id, coach_id } = await req.json()
  if (!from_month_id || !to_month_id) {
    return NextResponse.json({ error: '원본/대상 월 필요' }, { status: 400 })
  }

  // 원본 월 플랜 조회
  let query = supabaseAdmin
    .from('lesson_plans')
    .select('*')
    .eq('month_id', from_month_id)

  if (coach_id) query = query.eq('coach_id', coach_id)

  const { data: sourcePlans } = await query

  if (!sourcePlans || sourcePlans.length === 0) {
    return NextResponse.json({ error: '복사할 플랜이 없습니다' }, { status: 404 })
  }

  // 대상 월에 이미 있는 회원 확인 (중복 방지)
  const { data: existingPlans } = await supabaseAdmin
    .from('lesson_plans')
    .select('member_id, coach_id')
    .eq('month_id', to_month_id)

  const existingSet = new Set(
    (existingPlans ?? []).map((p: any) => `${p.member_id}_${p.coach_id}`)
  )

  const newPlans = sourcePlans
    .filter((p: any) => !existingSet.has(`${p.member_id}_${p.coach_id}`))
    .map((p: any) => ({
      member_id:        p.member_id,
      coach_id:         p.coach_id,
      month_id:         to_month_id,
      lesson_type:      p.lesson_type,
      total_count:      p.total_count,
      completed_count:  0,
      payment_status:   'unpaid',
      amount:           p.amount,
      unit_minutes:     p.unit_minutes,
      program_id:       p.program_id ?? null,
      next_month_synced: false,
    }))

  if (newPlans.length === 0) {
    return NextResponse.json({ ok: true, copied: 0, skipped: sourcePlans.length, message: '이미 모두 등록된 플랜입니다' })
  }

  const { error } = await supabaseAdmin.from('lesson_plans').insert(newPlans)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    copied: newPlans.length,
    skipped: sourcePlans.length - newPlans.length,
    message: `${newPlans.length}개 플랜 복사 완료${sourcePlans.length - newPlans.length > 0 ? ` (${sourcePlans.length - newPlans.length}개 중복 건너뜀)` : ''}`,
  })
}
