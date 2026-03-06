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
    member: { id: string; name: string }
    coach:  { id: string; name: string }
  }
}

interface Coach {
  id: string
  name: string
}

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  scheduled: { bg: '#f0fdf4', border: '#4ade80', color: '#15803d', label: '예정' },
  completed: { bg: '#eff6ff', border: '#60a5fa', color: '#1d4ed8', label: '완료' },
  absent:    { bg: '#fef2f2', border: '#f87171', color: '#b91c1c', label: '결석' },
  makeup:    { bg: '#fdf4ff', border: '#c084fc', color: '#7e22ce', label: '보강' },
}

export default function SchedulePage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate]         = useState(today)
  const [slots, setSlots]       = useState<Slot[]>([])
  const [coaches, setCoaches]   = useState<Coach[]>([])
  const [coachId, setCoachId]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const url = `/api/lesson-slots?date=${date}${coachId ? `&coach_id=${coachId}` : ''}`
    const res = await fetch(url)
    const data = await res.json()
    setSlots(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [date, coachId])

  useEffect(() => { load() }, [load])

  const handleStatus = async (status: string) => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/lesson-slots/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setSaving(false)
    setSelected(null)
    load()
  }

  const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>스케줄</h1>
        <Link href="/owner/lesson-plan" style={{ marginLeft: 'auto', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'none' }}>
          + 레슨 등록
        </Link>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        {/* 필터 */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', color: '#111827' }} />
          <select value={coachId} onChange={e => setCoachId(e.target.value)}
            style={{ padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', color: '#111827', flex: 1 }}>
            <option value="">전체 코치</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
          </select>
        </div>

        {/* 슬롯 목록 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : slots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
            <p>이 날 수업이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {slots.map(s => {
              const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
              return (
                <div key={s.id} onClick={() => setSelected(s)}
                  style={{ background: st.bg, borderLeft: `4px solid ${st.border}`, borderRadius: '0 1rem 1rem 0', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: st.color, flexShrink: 0, width: '52px' }}>
                    {fmtTime(s.scheduled_at)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{s.lesson_plan?.member?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                      {s.lesson_plan?.coach?.name} 코치 · {s.duration_minutes}분 · {s.lesson_plan?.lesson_type}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: `${st.border}33`, color: st.color }}>
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 슬롯 상세 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>수업 처리</h2>
            {[
              { label: '회원',    value: selected.lesson_plan?.member?.name },
              { label: '코치',    value: `${selected.lesson_plan?.coach?.name} 코치` },
              { label: '시간',    value: `${fmtTime(selected.scheduled_at)} (${selected.duration_minutes}분)` },
              { label: '레슨',    value: selected.lesson_plan?.lesson_type },
              { label: '현재상태', value: STATUS_STYLE[selected.status]?.label ?? selected.status },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #f9fafb' }}>
                <span style={{ width: '70px', flexShrink: 0, fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>{row.label}</span>
                <span style={{ fontSize: '0.875rem', color: '#111827' }}>{row.value}</span>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginTop: '1.25rem' }}>
              {[
                { status: 'completed', label: '✅ 완료', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
                { status: 'absent',    label: '❌ 결석', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
                { status: 'scheduled', label: '🔄 예정으로', bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
                { status: 'makeup',    label: '🔁 보강',   bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
              ].map(btn => (
                <button key={btn.status} onClick={() => handleStatus(btn.status)} disabled={saving}
                  style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${btn.border}`, background: btn.bg, color: btn.color, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
