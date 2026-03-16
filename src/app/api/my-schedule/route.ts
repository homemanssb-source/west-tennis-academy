// src/app/api/my-schedule/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'member') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  // Step 1: 내 lesson_plans ID 조회
  const { data: plans } = await supabaseAdmin
    .from('lesson_plans')
    .select('id')
    .eq('member_id', session.id)

  if (!plans || plans.length === 0) {
    return NextResponse.json([])
  }

  const planIds = plans.map((p: any) => p.id)

  // Step 2: 슬롯 조회 — ✅ draft/cancelled 제외 (초안은 확정 전이라 회원에게 안 보임)
  const { data, error } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, status, slot_type, memo,
      lesson_plan:lesson_plan_id (
        id, lesson_type, total_count, completed_count,
        coach:coach_id ( id, name ),
        month:month_id ( id, year, month )
      )
    `)
    .in('lesson_plan_id', planIds)
    .not('status', 'in', '("draft","cancelled")')
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}