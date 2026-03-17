// src/app/api/lesson-slots/[id]/route.ts
// ✅ [FIX] 알림 날짜 포맷 UTC 버그 수정 (서버에서 getMonth() → KST 변환)
// ✅ [FIX] reschedule 후 recalcAndSavePlan 호출 (요일별 할증 반영)
// ✅ [FIX] 알림 fmtDt 함수 KST 기준으로 수정
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSession } from '@/lib/session'
import { recalcAndSavePlan } from '@/lib/calcAmount'

/** 서버 사이드 KST 날짜/시간 포맷 유틸 */
function fmtKSTDatetime(isoStr: string): string {
  const d = new Date(isoStr)
  // UTC → KST
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const month  = kst.getUTCMonth() + 1
  const day    = kst.getUTCDate()
  const hh     = String(kst.getUTCHours()).padStart(2, '0')
  const mm     = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${month}/${day} ${hh}:${mm}`
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin', 'coach'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { status, memo, scheduled_at } = body

  // ── 날짜/시간 수정 경로 ──────────────────────────────────────
  if (scheduled_at !== undefined) {
    const { data: currentSlot } = await supabaseAdmin
      .from('lesson_slots')
      .select(`
        id, status, scheduled_at, duration_minutes,
        lesson_plan:lesson_plan_id (
          id,
          lesson_type,
          member:member_id ( id, name )
        )
      `)
      .eq('id', id)
      .single()

    if (!currentSlot) {
      return NextResponse.json({ error: '슬롯을 찾을 수 없습니다' }, { status: 404 })
    }

    // 코치는 scheduled 상태만 수정 가능
    if (session.role === 'coach' && currentSlot.status !== 'scheduled') {
      return NextResponse.json(
        { error: '예정 상태인 수업만 날짜/시간을 변경할 수 있습니다' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('lesson_slots')
      .update({ scheduled_at })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ✅ [FIX] KST 기준 알림 날짜 포맷
    const oldDtStr = fmtKSTDatetime(currentSlot.scheduled_at)
    const newDtStr = fmtKSTDatetime(scheduled_at)

    const plan = currentSlot.lesson_plan as any
    const memberId   = plan?.member?.id
    const lessonType = plan?.lesson_type ?? '수업'
    const planId     = plan?.id

    // 회원 알림 발송
    if (memberId) {
      await supabaseAdmin.from('notifications').insert({
        profile_id: memberId,
        title: '📅 수업 일정 변경 안내',
        body: `${lessonType} 수업 일정이 변경되었습니다.\n변경 전: ${oldDtStr}\n변경 후: ${newDtStr}`,
        type: 'info',
        link: '/member/schedule',
      })
    }

    // ✅ [NEW] 일정 변경 후 금액 재계산 (요일별 할증: sat/sun surcharge 반영)
    if (planId) {
      await recalcAndSavePlan(planId)
    }

    return NextResponse.json({ ok: true })
  }

  // ── 상태/메모 수정 경로 ──────────────────────────────────────
  const update: Record<string, unknown> = {}
  if (status !== undefined && status !== '') update.status = status
  if (memo !== undefined) update.memo = memo

  // 완료 처리 시 completed_count 증가
  if (status === 'completed') {
    const { data: slot } = await supabaseAdmin
      .from('lesson_slots')
      .select('lesson_plan_id, status')
      .eq('id', id)
      .single()

    if (slot && slot.status !== 'completed') {
      await supabaseAdmin.rpc('increment_completed', { plan_id: slot.lesson_plan_id })
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabaseAdmin.from('lesson_slots').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !['owner', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await params

  // lesson_applications.original_slot_id 참조 해제
  await supabaseAdmin
    .from('lesson_applications')
    .update({ original_slot_id: null })
    .eq('original_slot_id', id)

  const { error } = await supabaseAdmin
    .from('lesson_slots')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}