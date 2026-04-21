// src/app/api/profiles/search/route.ts
// 이름으로 회원/코치 검색 (관리자 전용)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (!q) return NextResponse.json([])

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, phone, role, is_active')
    .in('role', ['member', 'coach'])
    .ilike('name', `%${q}%`)
    .eq('is_active', true)
    .order('role', { ascending: true })
    .order('name', { ascending: true })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
