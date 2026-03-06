import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const memberId = req.nextUrl.searchParams.get('member_id') ?? session.id

  const { data, error } = await supabaseAdmin
    .from('makeup_bookings')
    .select(`
      id, status, created_at,
      original_slot:original_slot_id (
        id, scheduled_at, duration_minutes,
        lesson_plan:lesson_plan_id ( lesson_type, coach:coach_id(name) )
      ),
      makeup_slot:makeup_slot_id (
        id, scheduled_at, duration_minutes, status
      )
    `)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { original_slot_id, makeup_datetime } = await req.json()
  if (!original_slot_id || !makeup_datetime) {
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  }

  // 원래 슬롯 확인
  const { data: origSlot } = await supabaseAdmin
    .from('lesson_slots')
    .select('id, lesson_plan_id, duration_minutes, status, scheduled_at')
    .eq('id', original_slot_id)
    .single()

  if (!origSlot) return NextResponse.json({ error: '슬롯 없음' }, { status: 404 })

  // 보강 슬롯 생성
  const { data: makeupSlot, error: slotErr } = await supabaseAdmin
    .from('lesson_slots')
    .insert({
      lesson_plan_id:   origSlot.lesson_plan_id,
      scheduled_at:     makeup_datetime,
      duration_minutes: origSlot.duration_minutes,
      status:           'scheduled',
      is_makeup:        true,
      slot_type:        'lesson',
    })
    .select('id')
    .single()

  if (slotErr) return NextResponse.json({ error: slotErr.message }, { status: 500 })

  // 원래 슬롯 absent 처리
  await supabaseAdmin.from('lesson_slots').update({ status: 'absent' }).eq('id', original_slot_id)

  // 보강 예약 생성
  const { data: booking, error: bookErr } = await supabaseAdmin
    .from('makeup_bookings')
    .insert({
      original_slot_id,
      makeup_slot_id: makeupSlot.id,
      member_id: session.role === 'member' ? session.id : (await supabaseAdmin
        .from('lesson_plans')
        .select('member_id')
        .eq('id', origSlot.lesson_plan_id)
        .single()
      ).data?.member_id,
      status: 'confirmed',
    })
    .select()
    .single()

  if (bookErr) return NextResponse.json({ error: bookErr.message }, { status: 500 })
  return NextResponse.json(booking)
}
