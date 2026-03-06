import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('lesson_programs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  try {
    const { name, ratio, max_students, unit_minutes, description } = await req.json()
    if (!name || !ratio || !max_students) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('lesson_programs')
      .insert({ name, ratio, max_students, unit_minutes: unit_minutes || 60, description, created_by: session.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
