import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner','admin','coach'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params

  // ✅ FIX #5: 코치는 자신의 블록만 삭제 가능
  if (session.role === 'coach') {
    const { data: block } = await supabaseAdmin
      .from('coach_blocks')
      .select('coach_id')
      .eq('id', id)
      .single()
    if (!block || block.coach_id !== session.id) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }
  }

  const { error } = await supabaseAdmin.from('coach_blocks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}