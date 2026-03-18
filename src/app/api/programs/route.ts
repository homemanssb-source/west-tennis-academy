// src/app/api/programs/route.ts
// ✅ fixed_schedules JSONB 컬럼 추가 (그룹수업 고정 스케줄)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const coachId = req.nextUrl.searchParams.get('coach_id')

  let data, error

  if (coachId) {
    const res = await supabaseAdmin
      .from('lesson_programs')
      .select('*')
      .eq('is_active', true)
      .or(`coach_id.is.null,coach_id.eq.${coachId}`)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    data  = res.data
    error = res.error
  } else {
    const res = await supabaseAdmin
      .from('lesson_programs')
      .select(`*, coach:coach_id ( id, name )`)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    data  = res.data
    error = res.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  try {
    const {
      name, ratio, max_students, unit_minutes, description,
      coach_id, default_amount, per_session_price, sort_order,
      fixed_schedules, // ✅ 추가
    } = await req.json()

    if (!name || !ratio || !max_students) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('lesson_programs')
      .insert({
        name,
        ratio,
        max_students,
        unit_minutes:      unit_minutes      || 60,
        description,
        coach_id:          coach_id          || null,
        default_amount:    default_amount    || 0,
        per_session_price: per_session_price || 0,
        sort_order:        sort_order        || 0,
        fixed_schedules:   fixed_schedules   || null, // ✅ 추가
        created_by:        session.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}