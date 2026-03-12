import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// GET /api/programs
// ?coach_id=xxx  → 해당 코치 전용 + 공통(NULL) 프로그램 반환
// ?coach_id=none → 공통 프로그램만
// (파라미터 없음) → 전체 (운영자 관리 페이지용)
export async function GET(req: NextRequest) {
  const coachId = req.nextUrl.searchParams.get('coach_id')

  let data, error

  if (coachId) {
    // 코치 선택 시: 공통(NULL) + 해당 코치 전용 프로그램 합쳐서 반환
    const res = await supabaseAdmin
      .from('lesson_programs')
      .select('*')
      .eq('is_active', true)
      .or(`coach_id.is.null,coach_id.eq.${coachId}`)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    data = res.data
    error = res.error
  } else {
    // 전체 조회 (운영자 관리용) - 비활성 포함
    const res = await supabaseAdmin
      .from('lesson_programs')
      .select(`
        *,
        coach:coach_id ( id, name )
      `)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    data = res.data
    error = res.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/programs
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  try {
    const {
      name, ratio, max_students, unit_minutes, description,
      coach_id,          // null이면 공통, 값 있으면 특정 코치 전용
      default_amount,    // 기본 수업료
      sort_order,        // 정렬 순서
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
        unit_minutes:   unit_minutes   || 60,
        description,
        coach_id:       coach_id       || null,
        default_amount: default_amount || 0,
        sort_order:     sort_order     || 0,
        created_by:     session.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}