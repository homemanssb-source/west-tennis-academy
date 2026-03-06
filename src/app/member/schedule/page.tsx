'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Slot {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  memo: string | null
  lesson_plan: {
    lesson_type: string
    coach: { name: string }
    month: { year: number; month: number }
  }
}

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  scheduled: { bg: '#f0fdf4', border: '#4ade80', color: '#15803d', label: '예정' },
  completed: { bg: '#eff6ff', border: '#60a5fa', color: '#1d4ed8', label: '완료' },
  absent:    { bg: '#fef2f2', border: '#f87171', color: '#b91c1c', label: '결석' },
  makeup:    { bg: '#fdf4ff', border: '#c084fc', color: '#7e22ce', label: '보강' },
}

export default function MemberSchedulePage() {
  const [slots, setSlots]     = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<'all'|'scheduled'|'completed'>('all')

  useEffect(() => {
    fetch('/api/my-schedule').then(r => r.json()).then(d => {
      setSlots(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const filtered = filter === 'all' ? slots : slots.filter(s => s.status === filter)

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
  }

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>내 스케줄</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all','scheduled','completed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '0.375rem 0.875rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                background: filter === f ? '#7e22ce' : '#f3f4f6',
                color: filter === f ? 'white' : '#6b7280' }}>
              {f === 'all' ? '전체' : f === 'scheduled' ? '예정' : '완료'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
            <p style={{ fontSize: '0.875rem' }}>수업 내역이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map(s => {
              const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
              return (
                <div key={s.id} style={{ background: st.bg, borderLeft: `4px solid ${st.border}`, borderRadius: '0 0.875rem 0.875rem 0', padding: '0.875rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: st.color, fontSize: '0.95rem' }}>{fmtDt(s.scheduled_at)}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: `${st.border}33`, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#374151' }}>{s.lesson_plan?.lesson_type} · {s.lesson_plan?.coach?.name} 코치 · {s.duration_minutes}분</div>
                  {s.memo && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>📝 {s.memo}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bottom-nav" style={{ paddingBottom: '0.5rem' }}>
        <Link href="/member" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>🏠</span><span>홈</span></Link>
        <Link href="/member/schedule" className="bottom-nav-item active"><span style={{ fontSize: '1.25rem' }}>📅</span><span>스케줄</span></Link>
        <Link href="/member/payment" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>💰</span><span>납부</span></Link>
      </div>
    </div>
  )
}