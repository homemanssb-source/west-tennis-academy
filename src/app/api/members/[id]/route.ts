// src/app/api/members/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params

  const [{ data: member }, { data: plans }, { data: family }] = await Promise.all([
    // ✅ discount_amount, discount_memo 추가
    supabaseAdmin
      .from('profiles')
      .select('id, name, phone, created_at, discount_amount, discount_memo, coach:coach_id(name)')
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('lesson_plans')
      .select(`
        id, lesson_type, total_count, completed_count, payment_status,
        amount, unit_minutes, billing_count, discount_amount, discount_memo, created_at,
        month:month_id ( year, month ),
        coach:coach_id ( name ),
        slots:lesson_slots ( id, status, scheduled_at, is_makeup )
      `)
      .eq('member_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('family_members').select('*').eq('account_id', id),
  ])

  if (!member) return NextResponse.json({ error: '회원 없음' }, { status: 404 })

  const allSlots         = (plans ?? []).flatMap((p: any) => p.slots ?? [])
  const totalLessons     = allSlots.length
  const completedLessons = allSlots.filter((s: any) => s.status === 'completed').length
  const absentLessons    = allSlots.filter((s: any) => s.status === 'absent').length
  const makeupLessons    = allSlots.filter((s: any) => s.is_makeup).length
  const attendanceRate   = totalLessons > 0 ? Math.round(completedLessons / totalLessons * 100) : 0
  const totalPaid        = (plans ?? []).filter((p: any) => p.payment_status === 'paid').reduce((s: number, p: any) => s + (p.amount || 0), 0)
  const totalUnpaid      = (plans ?? []).filter((p: any) => p.payment_status === 'unpaid').reduce((s: number, p: any) => s + (p.amount || 0), 0)
  const sinceDate        = member.created_at ? new Date(member.created_at).toLocaleDateString('ko-KR') : '-'

  return NextResponse.json({
    member: { ...member, sinceDate },
    stats:  { totalLessons, completedLessons, absentLessons, makeupLessons, attendanceRate, totalPaid, totalUnpaid },
    plans:  plans ?? [],
    family: family ?? [],
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()

  if (body.action === 'reset_pin') {
    const bcrypt = await import('bcryptjs')
    const tempPin  = Math.floor(100000 + Math.random() * 900000).toString()
    const pin_hash = await bcrypt.hash(tempPin, 10)
    await supabaseAdmin.from('profiles').update({ pin_hash, pin_must_change: true }).eq('id', id)
    return NextResponse.json({ temp_pin: tempPin }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
      },
    })
  }

  if (body.action === 'toggle_active') {
    const { data: profile } = await supabaseAdmin.from('profiles').select('is_active').eq('id', id).single()
    await supabaseAdmin.from('profiles').update({ is_active: !profile?.is_active }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  // ✅ 할인 정보 수정
  if (body.action === 'update_discount') {
    const { discount_amount, discount_memo } = body
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        discount_amount: discount_amount ?? 0,
        discount_memo:   discount_memo   ?? null,
      })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // 이름/전화번호 수정
  const { name, phone } = body
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ name, phone: phone?.replace(/-/g, '') })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}