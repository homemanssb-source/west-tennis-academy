'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Slot {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  slot_type: string
  memo: string | null
  lesson_plan: {
    id: string
    lesson_type: string
    member: { id: string; name: string; phone: string }
    coach:  { id: string; name: string }
  }
}

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  scheduled: { bg: '#f0fdf4', border: '#4ade80', color: '#15803d', label: '예정' },
  completed: { bg: '#eff6ff', border: '#60a5fa', color: '#1d4ed8', label: '완료' },
  absent:    { bg: '#fef2f2', border: '#f87171', color: '#b91c1c', label: '결석' },
  makeup:    { bg: '#fdf4ff', border: '#c084fc', color: '#7e22ce', label: '보강' },
}

export default function CoachSchedulePage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate]         = useState(today)
  const [slots, setSlots]       = useState<Slot[]>([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [saving, setSaving]     = useState(false)
  const [memo, setMemo]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/lesson-slots?date=${date}`)
    const data = await res.json()
    setSlots(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  const handleCancel = async () => {
    if (!selected) return
    const reason = prompt('취소 사유 (선택사항)')
    if (reason === null) return // 취소 누름
    setSaving(true)
    await fetch('/api/lesson-slots/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id: selected.id, reason }),
    })
    setSaving(false)
    setSelected(null)
    setMemo('')
    load()
  }

  const handleStatus = async (status: string) => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/lesson-slots/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, memo: memo || null }),
    })
    setSaving(false)
    setSelected(null)
    setMemo('')
    load()
  }

  const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

  const changeDate = (days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().split('T')[0])
  }

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>스케줄</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => changeDate(-1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>‹</button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', textAlign: 'center' }} />
          <button onClick={() => changeDate(1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>›</button>
        </div>
      </div>

      {/* 슬롯 목록 */}
      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : slots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
            <p style={{ fontSize: '0.875rem' }}>이 날 수업이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {slots.map(s => {
              const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
              return (
                <div key={s.id} onClick={() => { setSelected(s); setMemo(s.memo ?? '') }}
                  style={{ background: st.bg, borderLeft: `4px solid ${st.border}`, borderRadius: '0 0.875rem 0.875rem 0', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: st.color, flexShrink: 0, width: '48px' }}>{fmtTime(s.scheduled_at)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{s.lesson_plan?.member?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.duration_minutes}분 · {s.lesson_plan?.lesson_type}</div>
                    {s.memo && <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>📝 {s.memo}</div>}
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: `${st.border}33`, color: st.color, flexShrink: 0 }}>{st.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 하단 탭바 */}
      <div className="bottom-nav">
        <Link href="/coach" className="bottom-nav-item">
          <span style={{ fontSize: '1.25rem' }}>🏠</span>
          <span>홈</span>
        </Link>
        <Link href="/coach/schedule" className="bottom-nav-item active">
          <span style={{ fontSize: '1.25rem' }}>📅</span>
          <span>스케줄</span>
        </Link>
      </div>

      {/* 수업 처리 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setMemo('') } }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '390px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>수업 처리</h2>
            <div style={{ background: '#f9fafb', borderRadius: '0.875rem', padding: '0.875rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{selected.lesson_plan?.member?.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>{fmtTime(selected.scheduled_at)} · {selected.duration_minutes}분 · {selected.lesson_plan?.lesson_type}</div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>메모 (선택)</label>
              <input className="input-base" placeholder="특이사항 입력" value={memo} onChange={e => setMemo(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
              {[
                { status: 'completed', label: '✅ 완료', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
                { status: 'absent',    label: '❌ 결석', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
                { status: 'makeup',    label: '🔁 보강',  bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
                { status: 'scheduled', label: '🔄 예정',  bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
              ].map(btn => (
                <button key={btn.status} onClick={() => handleStatus(btn.status)} disabled={saving}
                  style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${btn.border}`, background: btn.bg, color: btn.color, fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {btn.label}
                </button>
              ))}
            </div>
            {selected.status !== 'completed' && (
              <button onClick={handleCancel} disabled={saving}
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                🗑 수업 취소 (회원 알림 발송)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

