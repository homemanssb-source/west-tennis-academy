// src/app/api/coach/payment/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'coach') {
    return NextResponse.json({ error: '코치만 접근 가능합니다' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const month_id = searchParams.get('month_id')

  let query = supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, lesson_type, unit_minutes, total_count, completed_count,
      payment_status, amount,
      member:profiles!lesson_plans_member_id_fkey(id, name, phone),
      month:months(id, year, month),
      slots:lesson_slots(id, status)
    `)
    .eq('coach_id', session.id)
    .order('created_at', { ascending: false })

  if (month_id) query = query.eq('month_id', month_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data ?? []).map((p: any) => ({
    ...p,
    total_count:     p.slots?.length ?? p.total_count,
    completed_count: p.slots?.filter((s: any) => s.status === 'completed').length ?? p.completed_count,
  }))

  return NextResponse.json(result)
}

// ✅ 추가: 코치가 납부 확인 처리 (미납 → 납부 확인 요청)
// - 코치는 본인 플랜만 paid 처리 가능
// - unpaid → paid 단방향만 허용 (paid → unpaid 는 관리자만)
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'coach') {
    return NextResponse.json({ error: '코치만 접근 가능합니다' }, { status: 403 })
  }

  const { plan_id } = await req.json()
  if (!plan_id) return NextResponse.json({ error: 'plan_id 필요' }, { status: 400 })

  // 본인 플랜인지 + 현재 unpaid 상태인지 확인
  const { data: plan, error: fetchErr } = await supabaseAdmin
    .from('lesson_plans')
    .select('id, coach_id, payment_status, member:profiles!lesson_plans_member_id_fkey(name), month:months(year, month)')
    .eq('id', plan_id)
    .single()

  if (fetchErr || !plan) {
    return NextResponse.json({ error: '플랜 정보 없음' }, { status: 404 })
  }
  if (plan.coach_id !== session.id) {
    return NextResponse.json({ error: '본인 담당 플랜만 처리 가능합니다' }, { status: 403 })
  }
  if (plan.payment_status === 'paid') {
    return NextResponse.json({ error: '이미 납부 완료 상태입니다' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('lesson_plans')
    .update({ payment_status: 'paid' })
    .eq('id', plan_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 운영자/관리자에게 알림
  const { data: admins } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role', ['owner', 'admin'])
    .eq('is_active', true)

  const member = (plan as any).member
  const month  = (plan as any).month

  if (admins && admins.length > 0) {
    await supabaseAdmin.from('notifications').insert(
      admins.map((a: any) => ({
        profile_id: a.id,
        title: '💰 납부 확인 처리',
        body: `${session.name} 코치가 ${member?.name}님의 ${month?.year}년 ${month?.month}월 수업료를 납부 확인 처리했습니다.`,
        type: 'info',
        link: '/owner/payment',
      }))
    )
  }

  return NextResponse.json({ ok: true })
}