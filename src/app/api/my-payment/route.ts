// src/app/api/my-payment/route.ts
// ✅ fix: family_member join 추가 (자녀 이름 표시)
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, payment_status, amount, lesson_type, total_count, completed_count, unit_minutes, created_at,
      family_member_id,
      coach:coach_id ( id, name ),
      month:month_id ( id, year, month ),
      family_member:family_member_id ( id, name )
    `)
    .eq('member_id', session.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data ?? []).map((p: any) => ({
    ...p,
    family_member_name: p.family_member?.name ?? null,
  }))

  return NextResponse.json(result)
}