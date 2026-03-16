// src/app/api/member-requests/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// GET /api/member-requests?month_id=xxx
// 해당 월의 회원 수정 요청 전체 조회 (운영자/관리자)
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner','admin','coach'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const monthId = req.nextUrl.searchParams.get('month_id')
  if (!monthId) return NextResponse.json({ error: 'month_id 필요' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('lesson_applications')
    .select(`
      id, requested_at, request_type, status, draft_slot_id,
      lesson_type, duration_minutes, admin_note, coach_note,
      member:profiles!lesson_applications_member_id_fkey(id, name),
      coach:profiles!lesson_applications_coach_id_fkey(id, name)
    `)
    .eq('month_id', monthId)
    .in('request_type', ['change', 'exclude', 'add'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = (data ?? []).map((r: any) => ({
    ...r,
    member_name: r.member?.name ?? '',
    coach_name:  r.coach?.name  ?? '',
  }))

  return NextResponse.json(result)
}
