'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface SlotItem {
  id: string
  time: string
  duration: number
  status: string
  member: string
  lessonType: string
  isMakeup: boolean
}

interface CoachStat {
  id: string
  name: string
  total: number
  completed: number
  scheduled: number
  absent: number
  slots: SlotItem[]
}

interface DashData {
  date: string
  total: number
  completed: number
  scheduled: number
  absent: number
  byCoach: CoachStat[]
}

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  scheduled: { bg: '#f0fdf4', border: '#4ade80', color: '#15803d', label: '예정' },
  completed: { bg: '#eff6ff', border: '#60a5fa', color: '#1d4ed8', label: '완료' },
  absent:    { bg: '#fef2f2', border: '#f87171', color: '#b91c1c', label: '결석' },
  makeup:    { bg: '#fdf4ff', border: '#c084fc', color: '#7e22ce', label: '보강' },
}

export default function DashboardPage() {
  const [data,    setData]    = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpd, setLastUpd] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/dashboard')
    if (res.ok) {
      const d = await res.json()
      setData(d)
      setLastUpd(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000) // 30초마다 자동 갱신
    return () => clearInterval(interval)
  }, [load])

  const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', padding: '1.5rem', fontFamily: 'Noto Sans KR, sans-serif' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#64748b', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#16A34A', letterSpacing: '2px' }}>WTA LIVE</div>
            <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{data ? fmtDate(data.date) : '...'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>🔄 {lastUpd} 갱신</div>
          <button onClick={load} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.625rem', padding: '0.5rem 1rem', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            새로고침
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '6rem', color: '#64748b' }}>불러오는 중...</div>
      ) : !data ? null : (
        <>
          {/* 전체 통계 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: '전체 수업', value: data.total,     color: '#60a5fa', bg: '#1e3a5f' },
              { label: '완료',      value: data.completed, color: '#4ade80', bg: '#14532d' },
              { label: '예정',      value: data.scheduled, color: '#fbbf24', bg: '#451a03' },
              { label: '결석',      value: data.absent,    color: '#f87171', bg: '#450a0a' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: '1rem', padding: '1.25rem', textAlign: 'center', border: `1px solid ${s.color}33` }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.8rem', color: s.color, fontWeight: 600, marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* 코치별 현황 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: '1rem' }}>
            {data.byCoach.map(coach => (
              <div key={coach.id} style={{ background: '#1e293b', borderRadius: '1rem', border: '1px solid #334155', overflow: 'hidden' }}>
                {/* 코치 헤더 */}
                <div style={{ background: '#0f172a', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#16A34A22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🎾</div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'white', fontSize: '1rem' }}>{coach.name} 코치</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>오늘 {coach.total}회</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{ background: '#14532d', color: '#4ade80', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>완료 {coach.completed}</span>
                    <span style={{ background: '#451a03', color: '#fbbf24', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>예정 {coach.scheduled}</span>
                    {coach.absent > 0 && <span style={{ background: '#450a0a', color: '#f87171', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>결석 {coach.absent}</span>}
                  </div>
                </div>

                {/* 수업 목록 */}
                <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
                  {coach.slots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#475569', fontSize: '0.875rem' }}>오늘 수업 없음</div>
                  ) : coach.slots.map(s => {
                    const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
                    return (
                      <div key={s.id} style={{ background: '#0f172a', borderLeft: `3px solid ${st.border}`, borderRadius: '0 0.625rem 0.625rem 0', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: st.color, width: '44px', flexShrink: 0 }}>{fmtTime(s.time)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'white' }}>
                            {s.member}
                            {s.isMakeup && <span style={{ marginLeft: '6px', background: '#4c1d95', color: '#c084fc', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '9999px' }}>보강</span>}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{s.lessonType} · {s.duration}분</div>
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '9999px', background: `${st.border}22`, color: st.color, flexShrink: 0 }}>{st.label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* 진행률 바 */}
                {coach.total > 0 && (
                  <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #334155' }}>
                    <div style={{ height: '6px', background: '#334155', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(coach.completed / coach.total * 100)}%`, background: '#16A34A', borderRadius: '9999px', transition: 'width 0.5s ease' }}></div>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', textAlign: 'right' }}>
                      {Math.round(coach.completed / coach.total * 100)}% 완료
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
