import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'

  const { data, error } = await supabaseAdmin
    .from('member_applications')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  // 누구나 가입 신청 가능 (로그인 불필요)
  try {
    const body = await req.json()
    const { name, phone, birth_date, address, emergency_contact, health_notes, desired_schedule } = body

    if (!name || !phone) {
      return NextResponse.json({ error: '이름과 전화번호는 필수입니다' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('member_applications')
      .insert({ name, phone: phone.replace(/-/g,''), birth_date, address, emergency_contact, health_notes, desired_schedule })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
