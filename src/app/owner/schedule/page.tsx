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
  family_member_name: string | null  // ✅ 추가
  lesson_plan: {
    id: string
    lesson_type: string
    member: { id: string; name: string; phone?: string }
    coach:  { id: string; name: string }
  }
}

interface Coach { id: string; name: string }

interface PendingSlot {
  id: string
  scheduled_at: string
  duration_minutes: number
  memo: string | null
  lesson_plan: {
    id: string
    lesson_type: string
    member: { id: string; name: string; phone: string }
    coach:  { id: string; name: string }
    month:  { year: number; month: number }
  }
}

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  scheduled: { bg: '#f0fdf4', border: '#4ade80', color: '#15803d', label: '예정' },
  completed: { bg: '#eff6ff', border: '#60a5fa', color: '#1d4ed8', label: '완료' },
  absent:    { bg: '#fef2f2', border: '#f87171', color: '#b91c1c', label: '결석' },
  makeup:    { bg: '#fdf4ff', border: '#c084fc', color: '#7e22ce', label: '보강' },
  cancelled: { bg: '#f9fafb', border: '#d1d5db', color: '#6b7280', label: '취소' },
}

const DAYS = ['일','월','화','수','목','금','토']

export default function SchedulePage() {
  const today = new Date().toISOString().split('T')[0]
  const [tab,     setTab]     = useState<'schedule'|'pending'>('schedule')
  const [date,    setDate]    = useState(today)
  const [slots,   setSlots]   = useState<Slot[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [coachId, setCoachId] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [saving,  setSaving]  = useState(false)

  // 보강 대기
  const [pending,      setPending]      = useState<PendingSlot[]>([])
  const [pendingDone,  setPendingDone]  = useState<any[]>([])
  const [pendingLoad,  setPendingLoad]  = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [makeupTarget, setMakeupTarget] = useState<PendingSlot | null>(null)
  const [makeupDate,   setMakeupDate]   = useState('')
  const [makeupTime,   setMakeupTime]   = useState('')
  const [makingSaving, setMakingSaving] = useState(false)

  useEffect(() => {
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
    loadPending()
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

  const loadPending = async () => {
    setPendingLoad(true)
    const res = await fetch('/api/makeup/pending')
    const d = await res.json()
    if (d.pending) {
      setPending(d.pending)
      setPendingDone(d.done ?? [])
      setPendingCount(d.pending.length)
    }
    setPendingLoad(false)
  }

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

  const handleMakeupSubmit = async () => {
    if (!makeupTarget || !makeupDate || !makeupTime) return
    setMakingSaving(true)
    const makeup_datetime = `${makeupDate}T${makeupTime}:00+09:00`
    const res = await fetch('/api/makeup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_slot_id: makeupTarget.id, makeup_datetime }),
    })
    const d = await res.json()
    setMakingSaving(false)
    if (d.error) { alert(d.error); return }
    setMakeupTarget(null)
    setMakeupDate('')
    setMakeupTime('')
    loadPending()
    load()
  }

  const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  const fmtDate = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  // ✅ 표시 이름: 자녀 있으면 "자녀(부모)" 형태
  const displayName = (s: Slot) => {
    const memberName = s.lesson_plan?.member?.name ?? '-'
    if (s.family_member_name) return `${s.family_member_name}(${memberName})`
    return memberName
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>스케줄</h1>
          <Link href="/owner/lesson-plan"
            style={{ background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'none', fontFamily: 'Noto Sans KR, sans-serif' }}>
            + 레슨 등록
          </Link>
        </div>

        {/* 탭 */}
        <div style={{ maxWidth: '900px', margin: '0.75rem auto 0', display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setTab('schedule')}
            style={{ padding: '0.375rem 1rem', borderRadius: '9999px', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 700, fontSize: '0.8rem',
              background: tab === 'schedule' ? '#16A34A' : '#f3f4f6',
              color: tab === 'schedule' ? 'white' : '#6b7280' }}>
            📅 일별 수업
          </button>
          <button onClick={() => { setTab('pending'); loadPending() }}
            style={{ padding: '0.375rem 1rem', borderRadius: '9999px', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem',
              background: tab === 'pending' ? '#f97316' : '#f3f4f6',
              color: tab === 'pending' ? 'white' : '#6b7280' }}>
            🔴 보강 대기
            {pendingCount > 0 && (
              <span style={{ background: tab === 'pending' ? 'rgba(255,255,255,.3)' : '#fee2e2', color: tab === 'pending' ? 'white' : '#b91c1c', fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: '9999px' }}>
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>

        {/* ── 일별 수업 탭 ── */}
        {tab === 'schedule' && (
          <>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', color: '#111827' }} />
              <select value={coachId} onChange={e => setCoachId(e.target.value)}
                style={{ padding: '0.625rem 1rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', color: '#111827', flex: 1 }}>
                <option value="">전체 코치</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
              </select>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
            ) : slots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                <p>이날 수업이 없습니다</p>
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
                        {/* ✅ 자녀(부모) 형태로 표시 */}
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>
                          {displayName(s)}
                        </div>
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
          </>
        )}

        {/* ── 보강 대기 탭 ── */}
        {tab === 'pending' && (
          <>
            {pendingLoad ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
            ) : pending.length === 0 && pendingDone.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                <p>보강 대기 중인 수업이 없습니다</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* 보강 미완료 */}
                {pending.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', letterSpacing: '1px', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                      보강 미완료 ({pending.length}건)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {pending.map(s => (
                        <div key={s.id} style={{ background: 'white', border: '1.5px solid #fecaca', borderRadius: '1rem', padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 700, color: '#111827' }}>{s.lesson_plan?.member?.name}</span>
                                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{s.lesson_plan?.member?.phone}</span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '2px' }}>
                                {s.lesson_plan?.coach?.name} 코치 · {s.lesson_plan?.lesson_type}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#b91c1c', fontWeight: 600 }}>
                                취소된 수업: {fmtDate(s.scheduled_at)}
                              </div>
                              {s.memo && (
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>사유: {s.memo}</div>
                              )}
                            </div>
                            <button
                              onClick={() => { setMakeupTarget(s); setMakeupDate(''); setMakeupTime('') }}
                              style={{ padding: '0.5rem 0.875rem', background: '#7e22ce', color: 'white', border: 'none', borderRadius: '0.625rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif', flexShrink: 0 }}>
                              보강 잡기
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 보강 완료 */}
                {pendingDone.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', letterSpacing: '1px', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#9ca3af', display: 'inline-block' }}></span>
                      보강 완료 ({pendingDone.length}건)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {pendingDone.map((s: any) => (
                        <div key={s.id} style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: '1rem', padding: '1rem 1.25rem', opacity: 0.7 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, color: '#374151', fontSize: '0.9rem' }}>{s.lesson_plan?.member?.name}</div>
                              <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                                취소: {fmtDate(s.scheduled_at)} →
                                보강: {s.makeup_booking?.makeup_slot?.scheduled_at ? fmtDate(s.makeup_booking.makeup_slot.scheduled_at) : '미정'}
                              </div>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: '#dcfce7', color: '#15803d' }}>✓ 완료</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 수업 상태 변경 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>수업 관리</h2>
            {[
              { label: '회원',     value: displayName(selected) },
              { label: '코치',     value: `${selected.lesson_plan?.coach?.name} 코치` },
              { label: '시간',     value: `${fmtTime(selected.scheduled_at)} (${selected.duration_minutes}분)` },
              { label: '레슨',     value: selected.lesson_plan?.lesson_type },
              { label: '현재상태', value: STATUS_STYLE[selected.status]?.label ?? selected.status },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #f9fafb' }}>
                <span style={{ width: '70px', flexShrink: 0, fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>{row.label}</span>
                <span style={{ fontSize: '0.875rem', color: '#111827' }}>{row.value}</span>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginTop: '1.25rem' }}>
              {[
                { status: 'completed', label: '✅ 완료',     bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
                { status: 'absent',    label: '❌ 결석',     bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
                { status: 'scheduled', label: '🔄 예정으로', bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
                { status: 'makeup',    label: '🔁 보강',     bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
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

      {/* 보강 날짜 잡기 모달 */}
      {makeupTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setMakeupTarget(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '1.5rem', padding: '1.5rem' }}>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>🔁 보강 날짜 잡기</h2>
            <div style={{ background: '#fdf4ff', border: '1.5px solid #e9d5ff', borderRadius: '0.75rem', padding: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, color: '#7e22ce', fontSize: '0.9rem' }}>{makeupTarget.lesson_plan?.member?.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '2px' }}>
                취소 수업: {fmtDate(makeupTarget.scheduled_at)}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                {makeupTarget.lesson_plan?.coach?.name} 코치 · {makeupTarget.lesson_plan?.lesson_type}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>보강 날짜</label>
                <input type="date" value={makeupDate} onChange={e => setMakeupDate(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>보강 시간</label>
                <input type="time" value={makeupTime} onChange={e => setMakeupTime(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={handleMakeupSubmit} disabled={makingSaving || !makeupDate || !makeupTime}
                style={{ flex: 1, padding: '0.875rem', background: (!makeupDate || !makeupTime) ? '#e5e7eb' : '#7e22ce', color: (!makeupDate || !makeupTime) ? '#9ca3af' : 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: (!makeupDate || !makeupTime) ? 'not-allowed' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {makingSaving ? '등록 중...' : '보강 확정'}
              </button>
              <button onClick={() => setMakeupTarget(null)}
                style={{ padding: '0.875rem 1.25rem', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}