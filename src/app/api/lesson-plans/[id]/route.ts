import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('lesson_plans')
    .select(`
      id, lesson_type, unit_minutes, total_count, completed_count,
      payment_status, amount, created_at,
      member:profiles!lesson_plans_member_id_fkey(id, name, phone),
      coach:profiles!lesson_plans_coach_id_fkey(id, name),
      month:months(id, year, month),
      slots:lesson_slots(id, scheduled_at, duration_minutes, status, is_makeup, slot_type, memo)
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { lesson_type, unit_minutes, amount, payment_status, coach_id, month_id } = body

  const updates: Record<string, unknown> = {}
  if (lesson_type    !== undefined) updates.lesson_type    = lesson_type
  if (unit_minutes   !== undefined) updates.unit_minutes   = unit_minutes
  if (amount         !== undefined) updates.amount         = amount
  if (payment_status !== undefined) updates.payment_status = payment_status
  if (coach_id       !== undefined) updates.coach_id       = coach_id
  if (month_id       !== undefined) updates.month_id       = month_id

  const { error } = await supabaseAdmin
    .from('lesson_plans')
    .update(updates)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 슬롯 먼저 삭제 후 플랜 삭제
  await supabaseAdmin.from('lesson_slots').delete().eq('lesson_plan_id', params.id)
  const { error } = await supabaseAdmin.from('lesson_plans').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
