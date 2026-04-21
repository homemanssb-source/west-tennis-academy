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

  // ✅ perf: q='*' 는 "전체 반환 모드" — 프론트에서 한번 prefetch 후 클라이언트 필터
  let query = supabaseAdmin
    .from('profiles')
    .select('id, name, phone, role, is_active')
    .in('role', ['member', 'coach'])
    .eq('is_active', true)
    .order('role', { ascending: true })
    .order('name', { ascending: true })

  if (q === '*') {
    query = query.limit(2000)
  } else {
    query = query.ilike('name', `%${q}%`).limit(30)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
