import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner','admin','coach'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  const { status, memo } = body
  const update: Record<string, unknown> = {}
  if (status) update.status = status
  if (memo !== undefined) update.memo = memo

  // 수업 완료 시 completed_count 증가
  if (status === 'completed') {
    const { data: slot } = await supabaseAdmin
      .from('lesson_slots')
      .select('lesson_plan_id, status')
      .eq('id', id)
      .single()

    if (slot && slot.status !== 'completed') {
      await supabaseAdmin.rpc('increment_completed', { plan_id: slot.lesson_plan_id })
    }
  }

  const { error } = await supabaseAdmin.from('lesson_slots').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
