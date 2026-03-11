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
    .eq('coach_id', session.id)   // ✅ 반드시 본인 코치 플랜만
    .order('created_at', { ascending: false })

  if (month_id) query = query.eq('month_id', month_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // total_count / completed_count 를 실제 슬롯 기준으로 보정
  const result = (data ?? []).map((p: any) => ({
    ...p,
    total_count:     p.slots?.length ?? p.total_count,
    completed_count: p.slots?.filter((s: any) => s.status === 'completed').length ?? p.completed_count,
  }))

  return NextResponse.json(result)
}