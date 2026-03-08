import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

// GET /api/makeup/pending
// 취소됐지만 보강이 아직 잡히지 않은 슬롯 목록
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  // cancelled 상태 슬롯 조회
  const { data: cancelledSlots, error } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, memo, created_at,
      lesson_plan:lesson_plan_id (
        id, lesson_type,
        member:profiles!lesson_plans_member_id_fkey ( id, name, phone ),
        coach:profiles!lesson_plans_coach_id_fkey ( id, name ),
        month:months ( year, month )
      )
    `)
    .eq('status', 'cancelled')
    .order('scheduled_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 각 취소 슬롯에 대해 makeup_bookings에 보강이 잡혔는지 확인
  const slotIds = (cancelledSlots ?? []).map((s: any) => s.id)

  if (slotIds.length === 0) return NextResponse.json([])

  const { data: bookings } = await supabaseAdmin
    .from('makeup_bookings')
    .select('original_slot_id, status, makeup_slot:makeup_slot_id ( id, scheduled_at, status )')
    .in('original_slot_id', slotIds)

  const bookedMap = new Map((bookings ?? []).map((b: any) => [b.original_slot_id, b]))

  // 보강 미완료인 것만 필터
  const pending = (cancelledSlots ?? []).filter((s: any) => !bookedMap.has(s.id))
  const done    = (cancelledSlots ?? []).filter((s: any) =>  bookedMap.has(s.id))
    .map((s: any) => ({ ...s, makeup_booking: bookedMap.get(s.id) }))

  return NextResponse.json({ pending, done })
}
