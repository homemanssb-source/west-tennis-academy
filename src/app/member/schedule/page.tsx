'use client'

import { useEffect, useState } from 'react'
import MemberBottomNav from '@/components/MemberBottomNav'

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

interface MakeupBooking {
  id: string
  status: string
  created_at: string
  original_slot: {
    scheduled_at: string
    duration_minutes: number
    lesson_plan: { lesson_type: string; coach: { name: string } }
  }
  makeup_slot: {
    scheduled_at: string
    duration_minutes: number
    status: string
  } | null
}

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  scheduled: { bg: '#f0fdf4', border: '#4ade80', color: '#15803d', label: '예정' },
  completed: { bg: '#eff6ff', border: '#60a5fa', color: '#1d4ed8', label: '완료' },
  absent:    { bg: '#fef2f2', border: '#f87171', color: '#b91c1c', label: '결석' },
  makeup:    { bg: '#fdf4ff', border: '#c084fc', color: '#7e22ce', label: '보강' },
}

const MAKEUP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed:  { label: '확정', color: '#7e22ce', bg: '#f3e8ff' },
  cancelled:  { label: '취소', color: '#b91c1c', bg: '#fef2f2' },
  scheduled:  { label: '예정', color: '#15803d', bg: '#f0fdf4' },
  completed:  { label: '완료', color: '#1d4ed8', bg: '#eff6ff' },
}

export default function MemberSchedulePage() {
  const [slots, setSlots]           = useState<Slot[]>([])
  const [makeups, setMakeups]       = useState<MakeupBooking[]>([])
  const [loading, setLoading]       = useState(true)
  const [makeupLoading, setMakeupLoading] = useState(true)
  const [tab, setTab]               = useState<'schedule'|'makeup'>('schedule')
  const [filter, setFilter]         = useState<'all'|'scheduled'|'completed'>('all')

  useEffect(() => {
    fetch('/api/my-schedule').then(r => r.json()).then(d => {
      setSlots(Array.isArray(d) ? d : [])
      setLoading(false)
    })
    fetch('/api/makeup').then(r => r.json()).then(d => {
      setMakeups(Array.isArray(d) ? d : [])
      setMakeupLoading(false)
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
        <div style={{ display: 'flex', gap: '0', background: '#f3f4f6', borderRadius: '0.625rem', padding: '3px', marginBottom: '0.75rem' }}>
          <button onClick={() => setTab('schedule')}
            style={{ flex: 1, padding: '0.375rem 0', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer',
              background: tab === 'schedule' ? 'white' : 'transparent',
              color: tab === 'schedule' ? '#111827' : '#9ca3af' }}>
            📅 수업 일정
          </button>
          <button onClick={() => setTab('makeup')}
            style={{ flex: 1, padding: '0.375rem 0', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer',
              background: tab === 'makeup' ? 'white' : 'transparent',
              color: tab === 'makeup' ? '#111827' : '#9ca3af' }}>
            🔄 보강 내역
            {makeups.filter(m => m.status === 'confirmed').length > 0 && (
              <span style={{ marginLeft: '4px', background: '#7e22ce', color: 'white', borderRadius: '9999px', fontSize: '0.65rem', padding: '1px 6px' }}>
                {makeups.filter(m => m.status === 'confirmed').length}
              </span>
            )}
          </button>
        </div>
        {tab === 'schedule' && (
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
        )}
      </div>

      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem', overflowY: 'auto' }}>
        {tab === 'schedule' && (
          loading ? (
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
          )
        )}

        {tab === 'makeup' && (
          makeupLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
          ) : makeups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔄</div>
              <p style={{ fontSize: '0.875rem' }}>보강 내역이 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {makeups.map(m => {
                const orig = m.original_slot
                const makeup = m.makeup_slot
                const mst = MAKEUP_STATUS[makeup?.status ?? m.status] ?? MAKEUP_STATUS.confirmed
                return (
                  <div key={m.id} style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', padding: '0.875rem 1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', background: '#fef2f2', color: '#b91c1c', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700 }}>결석</span>
                      <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{fmtDt(orig.scheduled_at)}</span>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{orig.lesson_plan?.lesson_type} · {orig.lesson_plan?.coach?.name} 코치</span>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0' }}>↓ 보강</div>
                    {makeup ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: mst.color, fontSize: '0.9rem' }}>{fmtDt(makeup.scheduled_at)}</span>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>{makeup.duration_minutes}분</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: mst.bg, color: mst.color }}>{mst.label}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>보강 일정 미정</div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      <MemberBottomNav />
    </div>
  )
}