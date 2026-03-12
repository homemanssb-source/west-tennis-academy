import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import NotificationBell from '@/components/notifications/NotificationBell'
import MemberBottomNav from '@/components/MemberBottomNav'

export default async function MemberHomePage() {
  const session = await getSession()
  if (!session || session.role !== 'member') redirect('/auth/member')

  const today = new Date().toISOString().split('T')[0]
  const start = `${today}T00:00:00+09:00`
  const end   = `${today}T23:59:59+09:00`

  const { data: todaySlots } = await supabaseAdmin
    .from('lesson_slots')
    .select(`id, scheduled_at, duration_minutes, status, lesson_plan:lesson_plan_id ( lesson_type, coach:coach_id(name), member_id )`)
    .gte('scheduled_at', start)
    .lte('scheduled_at', end)

  const myToday = (todaySlots ?? []).filter((s: any) => s.lesson_plan?.member_id === session.id)

  const { data: plans } = await supabaseAdmin
    .from('lesson_plans')
    .select('id, payment_status, total_count, completed_count')
    .eq('member_id', session.id)

  const { count: pendingAppCount } = await supabaseAdmin
    .from('lesson_applications')
    .select('*', { count: 'exact', head: true })
    .eq('member_id', session.id)
    .in('status', ['pending_coach', 'pending_admin'])

  const totalLessons     = (plans ?? []).reduce((s: number, p: any) => s + p.total_count, 0)
  const completedLessons = (plans ?? []).reduce((s: number, p: any) => s + p.completed_count, 0)
  const unpaidCount      = (plans ?? []).filter((p: any) => p.payment_status === 'unpaid').length

  const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
    scheduled: { bg: '#f0fdf4', border: '#4ade80', color: '#15803d', label: '예정' },
    completed: { bg: '#eff6ff', border: '#60a5fa', color: '#1d4ed8', label: '완료' },
    absent:    { bg: '#fef2f2', border: '#f87171', color: '#b91c1c', label: '결석' },
    makeup:    { bg: '#fdf4ff', border: '#c084fc', color: '#7e22ce', label: '보강' },
  }
  const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ background: '#7e22ce', padding: '2rem 1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>WTA</div>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '0.75rem' }}>서부 테니스 아카데미</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <NotificationBell />
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>👤 {session.name}</div>
              <div style={{ color: 'rgba(255,255,255,.6)', fontSize: '0.75rem' }}>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', padding: '1rem 1.25rem 0' }}>
        {[
          { label: '전체 수업', value: totalLessons,     color: '#7e22ce', bg: '#fdf4ff', unit: '회' },
          { label: '완료',      value: completedLessons, color: '#1d4ed8', bg: '#eff6ff', unit: '회' },
          { label: '미납',      value: unpaidCount,      color: '#b91c1c', bg: '#fef2f2', unit: '건' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: '0.875rem', padding: '0.875rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: s.color }}>{s.unit} · {s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '1rem 1.25rem', flex: 1 }}>
        {/* 수업 신청 배너 */}
        <Link href="/member/apply" style={{ textDecoration: 'none' }}>
          <div style={{ marginBottom: '1rem', background: 'linear-gradient(135deg, #7e22ce, #6d28d9)', borderRadius: '0.875rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🎾</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'white' }}>수업 신청</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,.7)' }}>코치 시간표에서 원하는 시간 선택</div>
            </div>
            {(pendingAppCount ?? 0) > 0 && (
              <span style={{ background: '#fde68a', color: '#854d0e', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>
                처리중 {pendingAppCount}
              </span>
            )}
            <span style={{ color: 'rgba(255,255,255,.6)', fontSize: '1rem' }}>›</span>
          </div>
        </Link>

        {/* 오늘 수업 */}
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>오늘 수업</div>
        {myToday.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#9ca3af' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎾</div>
            <p style={{ fontSize: '0.875rem' }}>오늘 예정된 수업이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {myToday.map((s: any) => {
              const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
              return (
                <div key={s.id} style={{ background: st.bg, borderLeft: `4px solid ${st.border}`, borderRadius: '0 0.875rem 0.875rem 0', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: st.color, width: '48px', flexShrink: 0 }}>{fmtTime(s.scheduled_at)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{s.lesson_plan?.lesson_type}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.lesson_plan?.coach?.name} 코치 · {s.duration_minutes}분</div>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: `${st.border}33`, color: st.color }}>{st.label}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* 미납 배너 */}
        {unpaidCount > 0 && (
          <Link href="/member/payment" style={{ textDecoration: 'none' }}>
            <div style={{ marginTop: '1rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.875rem', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#b91c1c' }}>미납 {unpaidCount}건</div>
                <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>납부 현황 확인하러 가기 →</div>
              </div>
            </div>
          </Link>
        )}
      </div>

      <MemberBottomNav pendingAppCount={pendingAppCount ?? 0} />
    </div>
  )
}