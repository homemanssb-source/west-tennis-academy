import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import NotificationBell from '@/components/notifications/NotificationBell'
import CoachBottomNav from '@/components/CoachBottomNav'

export default async function CoachHomePage() {
  const session = await getSession()
  if (!session || !['owner','coach'].includes(session.role)) redirect('/auth/coach')

  // ✅ 수정: UTC 기준 → KST 기준 날짜 (자정 00:00~09:00 사이 하루 전날 뜨는 버그 수정)
  const kst   = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const today = kst.toISOString().split('T')[0]
  const start = `${today}T00:00:00+09:00`
  const end   = `${today}T23:59:59+09:00`

  // ✅ draft/cancelled 제외 — 초안은 확정 전이라 코치 홈에 표시 안 함
  const { data: slots } = await supabaseAdmin
    .from('lesson_slots')
    .select(`
      id, scheduled_at, duration_minutes, status, slot_type, memo,
      lesson_plan:lesson_plan_id (
        id, lesson_type,
        member:member_id ( id, name, phone ),
        coach:coach_id ( id, name )
      )
    `)
    .gte('scheduled_at', start)
    .lte('scheduled_at', end)
    .not('status', 'in', '("draft","cancelled")')
    .order('scheduled_at', { ascending: true })

  const mySlots = (slots ?? []).filter((s: any) => s.lesson_plan?.coach?.id === session.id)

  const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
    scheduled: { bg: '#f0fdf4', border: '#4ade80', color: '#15803d', label: '예정' },
    completed: { bg: '#eff6ff', border: '#60a5fa', color: '#1d4ed8', label: '완료' },
    absent:    { bg: '#fef2f2', border: '#f87171', color: '#b91c1c', label: '결석' },
    makeup:    { bg: '#fdf4ff', border: '#c084fc', color: '#7e22ce', label: '보강' },
  }

  const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#1d4ed8', padding: '2rem 1.25rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>WTA</div>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '0.75rem' }}>코치 대시보드</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <NotificationBell />
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>🎾 {session.name}</div>
              <div style={{ color: 'rgba(255,255,255,.6)', fontSize: '0.75rem' }}>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', padding: '1rem 1.25rem 0' }}>
        {[
          { label: '전체', value: mySlots.length, color: '#1d4ed8', bg: '#eff6ff' },
          { label: '완료', value: mySlots.filter((s:any) => s.status === 'completed').length, color: '#15803d', bg: '#f0fdf4' },
          { label: '예정', value: mySlots.filter((s:any) => s.status === 'scheduled').length, color: '#854d0e', bg: '#fef9c3' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: '0.875rem', padding: '0.875rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: s.color }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '1rem 1.25rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
          <Link href="/coach/blocks" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.875rem', padding: '0.875rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '2px' }}>🚫</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c' }}>휴무 관리</div>
            </div>
          </Link>
          <Link href="/coach/schedule" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.875rem', padding: '0.875rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '2px' }}>📅</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>전체 스케줄</div>
            </div>
          </Link>
        </div>
      </div>

      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem' }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>오늘 수업</div>
        {mySlots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#9ca3af' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎾</div>
            <p style={{ fontSize: '0.875rem' }}>오늘 예정된 수업이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {mySlots.map((s: any) => {
              const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
              return (
                <div key={s.id} style={{ background: st.bg, borderLeft: `4px solid ${st.border}`, borderRadius: '0 0.875rem 0.875rem 0', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: st.color, flexShrink: 0, width: '48px' }}>{fmtTime(s.scheduled_at)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{s.lesson_plan?.member?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.duration_minutes}분 · {s.lesson_plan?.lesson_type}</div>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: `${st.border}33`, color: st.color }}>{st.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CoachBottomNav />
    </div>
  )
}