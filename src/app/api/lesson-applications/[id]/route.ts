import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['coach', 'owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await req.json()
  console.log('🔵 PATCH 진입 id:', id, 'body:', body)

  const { action, coach_note, admin_note, requested_at, coach_id } = body

  let newStatus: string
  if (action === 'coach_approve') newStatus = 'pending_admin'
  else if (action === 'coach_reject') newStatus = 'rejected'
  else if (action === 'admin_approve') newStatus = 'approved'
  else if (action === 'admin_reject') newStatus = 'rejected'
  else return NextResponse.json({ error: '잘못된 action' }, { status: 400 })

  const updateData: Record<string, unknown> = { status: newStatus }
  if (coach_note !== undefined) updateData.coach_note = coach_note
  if (admin_note !== undefined) updateData.admin_note = admin_note
  if (requested_at) updateData.requested_at = requested_at
  if (coach_id) updateData.coach_id = coach_id

  console.log('🔵 updateData:', updateData)

  const { data, error } = await supabaseAdmin
    .from('lesson_applications')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.log('🔴 update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('🟢 update 성공:', data)

  if (action === 'admin_approve') {
    const { error: rpcError } = await supabaseAdmin.rpc('approve_lesson_application', { app_id: id })
    if (rpcError) console.log('🔴 rpc error:', rpcError)
    else console.log('🟢 rpc 성공')
  }

  return NextResponse.json(data)
}