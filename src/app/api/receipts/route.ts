import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const planId = req.nextUrl.searchParams.get('plan_id')
  if (!planId) return NextResponse.json([], { status: 200 })

  const { data, error } = await supabaseAdmin
    .from('payment_receipts')
    .select('*, uploader:uploaded_by(name)')
    .eq('lesson_plan_id', planId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin','payment'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { lesson_plan_id, image_url, amount, memo } = await req.json()
  if (!lesson_plan_id || !image_url) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  // 납부 완료로 변경
  await supabaseAdmin
    .from('lesson_plans')
    .update({ payment_status: 'paid' })
    .eq('id', lesson_plan_id)

  const { data, error } = await supabaseAdmin
    .from('payment_receipts')
    .insert({ lesson_plan_id, image_url, uploaded_by: session.id, amount, memo })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
