// src/app/api/members/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const withFamily = req.nextUrl.searchParams.get('with_family') === '1'

  // ✅ perf: LIMIT 1000 — 운영상 충분하고 페이지 초기 로드 속도 확보
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, phone, role, is_active, coach_id, created_at, discount_amount, discount_memo')
    .eq('role', 'member')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!withFamily || !data?.length) return NextResponse.json(data ?? [])

  // ✅ 자녀(family_members) 첨부 — 운영자 페이지에서 자녀 이름 검색 지원
  const memberIds = data.map(m => m.id)
  const { data: families } = await supabaseAdmin
    .from('family_members')
    .select('id, name, account_id')
    .in('account_id', memberIds)
    .eq('is_active', true)

  const childMap: Record<string, { id: string; name: string }[]> = {}
  for (const f of families ?? []) {
    if (!childMap[f.account_id]) childMap[f.account_id] = []
    childMap[f.account_id].push({ id: f.id, name: f.name })
  }

  const enriched = data.map(m => ({ ...m, children: childMap[m.id] ?? [] }))
  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  try {
    const { name, phone, coach_id } = await req.json()
    if (!name || !phone) return NextResponse.json({ error: '이름과 전화번호는 필수입니다' }, { status: 400 })

    const tempPin  = Math.floor(100000 + Math.random() * 900000).toString()
    const pin_hash = await bcrypt.hash(tempPin, 10)

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        name,
        phone:           phone.replace(/-/g, ''),
        role:            'member',
        pin_hash,
        pin_must_change: true,
        is_active:       true,
        coach_id:        coach_id || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: '이미 등록된 전화번호입니다' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ...data, temp_pin: tempPin }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}