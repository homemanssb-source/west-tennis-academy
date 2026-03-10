// lib/checkCoachBlock.ts
// ✅ FIX #13: repeat_weekly 서버 처리 공통 헬퍼
// 사용처: api/lesson-applications/route.ts, api/makeup/route.ts, api/lesson-plans/route.ts
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * 코치 휴무 충돌 체크 (repeat_weekly 포함 서버 처리)
 * @returns 충돌하는 block 객체 또는 null
 */
export async function checkCoachBlock(
  coachId: string,
  datetimeStr: string,
  durationMinutes: number
): Promise<{ reason?: string } | null> {
  const dt        = new Date(datetimeStr)
  const dateStr   = dt.toISOString().split('T')[0]
  const hhmm      = dt.toTimeString().slice(0, 5)       // "HH:MM"
  const dayOfWeek = dt.getDay()                          // 0=일 ~ 6=토
  const endDt     = new Date(dt.getTime() + durationMinutes * 60 * 1000)
  const endHhmm   = endDt.toTimeString().slice(0, 5)

  const { data: blocks } = await supabaseAdmin
    .from('coach_blocks')
    .select('*')
    .eq('coach_id', coachId)
    .or(
      `and(repeat_weekly.eq.false,block_date.eq.${dateStr}),` +
      `and(repeat_weekly.eq.true,day_of_week.eq.${dayOfWeek})`
    )

  if (!blocks || blocks.length === 0) return null

  for (const b of blocks) {
    // 종일 휴무
    if (!b.block_start && !b.block_end) return b
    // 시간대 겹침 체크
    const bStart = b.block_start ?? '00:00'
    const bEnd   = b.block_end   ?? '23:59'
    if (hhmm < bEnd && endHhmm > bStart) return b
  }

  return null
}