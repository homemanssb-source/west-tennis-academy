import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()

  // 활성/비활성 토글
  if (body.action === 'toggle_active') {
    const { data: cur } = await supabaseAdmin
      .from('lesson_programs')
      .select('is_active')
      .eq('id', id)
      .single()
    const { error } = await supabaseAdmin
      .from('lesson_programs')
      .update({ is_active: !cur?.is_active })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // 일반 업데이트 (coach_id, default_amount 포함)
  const {
    name, ratio, max_students, unit_minutes, description,
    coach_id, default_amount, sort_order,
  } = body

  const updateData: Record<string, unknown> = {
    name, ratio, max_students, unit_minutes, description,
  }
  // coach_id: 명시적으로 넘어온 경우만 업데이트 (null 허용)
  if ('coach_id' in body)       updateData.coach_id       = coach_id ?? null
  if ('default_amount' in body) updateData.default_amount = default_amount ?? 0
  if ('sort_order' in body)     updateData.sort_order     = sort_order ?? 0

  const { error } = await supabaseAdmin
    .from('lesson_programs')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const { error } = await supabaseAdmin.from('lesson_programs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}