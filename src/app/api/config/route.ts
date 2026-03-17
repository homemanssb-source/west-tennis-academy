// src/app/api/config/route.ts
// WTA 전체 설정 조회 / 수정 (운영자 전용)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// GET /api/config — 설정 조회 (로그인 필요)
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('wta_config')
    .select('session_threshold, sat_surcharge, sun_surcharge')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? { session_threshold: 8, sat_surcharge: 0, sun_surcharge: 0 })
}

// PUT /api/config — 설정 수정 (운영자만)
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { session_threshold, sat_surcharge, sun_surcharge } = await req.json()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (session_threshold !== undefined) updates.session_threshold = session_threshold
  if (sat_surcharge     !== undefined) updates.sat_surcharge     = sat_surcharge
  if (sun_surcharge     !== undefined) updates.sun_surcharge     = sun_surcharge

  // wta_config는 항상 id=1인 단일 행
  const { error } = await supabaseAdmin
    .from('wta_config')
    .update(updates)
    .eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
