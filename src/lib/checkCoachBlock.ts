// lib/checkCoachBlock.ts
// ✅ FIX #13: repeat_weekly 서버 처리 공통 헬퍼
// 사용처: api/lesson-applications/route.ts, api/makeup/route.ts, api/lesson-plans/route.ts
// ✅ FIX UTC→KST: 날짜/요일/시간 모두 KST 기준으로 수정 (자정 전후 버그 해결)
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
  const dt  = new Date(datetimeStr)
  const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000)

  const y       = kst.getUTCFullYear()
  const mo      = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d       = String(kst.getUTCDate()).padStart(2, '0')
  const dateStr   = `${y}-${mo}-${d}`
  const hhmm      = `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`
  const dayOfWeek = kst.getUTCDay()

  const endKst  = new Date(kst.getTime() + durationMinutes * 60 * 1000)
  const endHhmm = `${String(endKst.getUTCHours()).padStart(2, '0')}:${String(endKst.getUTCMinutes()).padStart(2, '0')}`

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
    if (!b.block_start && !b.block_end) return b
    const bStart = b.block_start ?? '00:00'
    const bEnd   = b.block_end   ?? '23:59'
    if (hhmm < bEnd && endHhmm > bStart) return b
  }

  return null
}