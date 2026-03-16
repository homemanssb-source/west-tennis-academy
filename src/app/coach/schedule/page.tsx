'use client'

import { useEffect, useState, useCallback } from 'react'
import CoachBottomNav from '@/components/CoachBottomNav'

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

const DAY_KO = ['일','월','화','수','목','금','토']

function getWeekDates(baseDate: string) {
  const d = new Date(baseDate)
  const dow = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    return date.toISOString().split('T')[0]
  })
}

export default function CoachSchedulePage() {
  const today = new Date().toISOString().split('T')[0]
  const [tab,     setTab]     = useState<'day'|'week'>('day')
  const [date,    setDate]    = useState(today)
  const [coachId, setCoachId] = useState('')
  const [slots,   setSlots]   = useState<Slot[]>([])
  const [weekSlots, setWeekSlots] = useState<Slot[]>([])
  const [loading,   setLoading]   = useState(false)
  const [selected,  setSelected]  = useState<Slot | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [memo,      setMemo]      = useState('')
  const [showMakeup,   setShowMakeup]   = useState(false)
  const [makeupDate,   setMakeupDate]   = useState('')
  const [makeupTime,   setMakeupTime]   = useState('')
  const [weekOffset,   setWeekOffset]   = useState(0)

  // 코치 본인 ID 조회 (세션 API)
  useEffect(() => {
    fetch('/api/session').then(r => r.json()).then(d => {
      if (d?.id) setCoachId(d.id)
    })
  }, [])

  // 일간 로드
  const load = useCallback(async () => {
    if (!coachId) return
    setLoading(true)
    const res = await fetch(`/api/lesson-slots?date=${date}&coach_id=${coachId}`)
    const data = await res.json()
    // 본인 코치 슬롯만 (API 필터 + 클라이언트 이중 필터)
    const filtered = (Array.isArray(data) ? data : []).filter(
      (s: Slot) => s.lesson_plan?.coach?.id === coachId
    )
    setSlots(filtered)
    setLoading(false)
  }, [date, coachId])

  // 주간 로드
  const loadWeek = useCallback(async () => {
    if (!coachId) return
    setLoading(true)
    const base = new Date(today)
    base.setDate(base.getDate() + weekOffset * 7)
    const weekDates = getWeekDates(base.toISOString().split('T')[0])
    const from = weekDates[0]
    const to   = weekDates[6]
    const res  = await fetch(`/api/lesson-slots?from=${from}&to=${to}&coach_id=${coachId}`)
    const data = await res.json()
    const filtered = (Array.isArray(data) ? data : []).filter(
      (s: Slot) => s.lesson_plan?.coach?.id === coachId
    )
    setWeekSlots(filtered)
    setLoading(false)
  }, [coachId, weekOffset, today])

  useEffect(() => { if (tab === 'day')  load() },     [load, tab])
  useEffect(() => { if (tab === 'week') loadWeek() }, [loadWeek, tab])

  const handleCancel = async () => {
    if (!selected) return
    const reason = prompt('취소 사유 (선택사항)')
    if (reason === null) return
    setSaving(true)
    await fetch('/api/lesson-slots/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id: selected.id, reason }),
    })
    setSaving(false)
    setSelected(null)
    setMemo('')
    tab === 'day' ? load() : loadWeek()
  }

  const handleStatus = async (status: string) => {
    if (!selected) return
    if (status === 'makeup') { setShowMakeup(true); return }
    setSaving(true)
    await fetch(`/api/lesson-slots/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, memo: memo || null }),
    })
    setSaving(false)
    setSelected(null)
    setMemo('')
    tab === 'day' ? load() : loadWeek()
  }

  const handleMakeupSubmit = async () => {
    if (!selected || !makeupDate || !makeupTime) return
    setSaving(true)
    await fetch('/api/makeup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_slot_id: selected.id,
        makeup_datetime: `${makeupDate}T${makeupTime}:00+09:00`,
      }),
    })
    setSaving(false)
    setShowMakeup(false)
    setSelected(null)
    setMakeupDate('')
    setMakeupTime('')
    tab === 'day' ? load() : loadWeek()
  }

  const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  const changeDate = (days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().split('T')[0])
  }

  // 주간 날짜 목록
  const base = new Date(today)
  base.setDate(base.getDate() + weekOffset * 7)
  const weekDates = getWeekDates(base.toISOString().split('T')[0])

  // 날짜별 슬롯 그룹
  const slotsByDate: Record<string, Slot[]> = {}
  weekDates.forEach(d => { slotsByDate[d] = [] })
  weekSlots.forEach(s => {
    const d = s.scheduled_at.split('T')[0]
    if (slotsByDate[d]) slotsByDate[d].push(s)
  })

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>스케줄</div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
          <button onClick={() => setTab('day')}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '0.625rem', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', background: tab === 'day' ? '#1d4ed8' : '#f3f4f6', color: tab === 'day' ? 'white' : '#6b7280' }}>
            📅 일간
          </button>
          <button onClick={() => setTab('week')}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '0.625rem', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', background: tab === 'week' ? '#1d4ed8' : '#f3f4f6', color: tab === 'week' ? 'white' : '#6b7280' }}>
            📆 주간
          </button>
        </div>

        {/* 일간 날짜 선택 */}
        {tab === 'day' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => changeDate(-1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>‹</button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', textAlign: 'center' }} />
            <button onClick={() => changeDate(1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>›</button>
          </div>
        )}

        {/* 주간 네비게이션 */}
        {tab === 'week' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setWeekOffset(w => w-1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>‹</button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#111827', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {weekDates[0].slice(5).replace('-','/')} ~ {weekDates[6].slice(5).replace('-','/')}
            </div>
            <button onClick={() => setWeekOffset(w => w+1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>›</button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem', overflowY: 'auto' }}>

        {/* ── 일간 뷰 ── */}
        {tab === 'day' && (
          loading ? (
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
                  <div key={s.id} onClick={() => { setSelected(s); setMemo(s.memo ?? ''); setShowMakeup(false) }}
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
          )
        )}

        {/* ── 주간 뷰 ── */}
        {tab === 'week' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {weekDates.map(d => {
                const daySlots = slotsByDate[d] ?? []
                const dateObj  = new Date(d)
                const isToday  = d === today
                const dow      = dateObj.getDay()
                return (
                  <div key={d}>
                    {/* 날짜 헤더 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: isToday ? '#1d4ed8' : '#f3f4f6', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: isToday ? 'rgba(255,255,255,.8)' : dow === 0 ? '#b91c1c' : dow === 6 ? '#1d4ed8' : '#6b7280' }}>{DAY_KO[dow]}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isToday ? 'white' : dow === 0 ? '#b91c1c' : dow === 6 ? '#1d4ed8' : '#374151', lineHeight: 1 }}>{dateObj.getDate()}</span>
                      </div>
                      <div style={{ flex: 1, height: '1px', background: '#f3f4f6' }} />
                      {daySlots.length > 0 && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>{daySlots.length}건</span>
                      )}
                    </div>

                    {/* 슬롯 목록 */}
                    {daySlots.length === 0 ? (
                      <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: '#d1d5db', fontFamily: 'Noto Sans KR, sans-serif' }}>수업 없음</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {daySlots
                          .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
                          .map(s => {
                            const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
                            return (
                              <div key={s.id} onClick={() => { setSelected(s); setMemo(s.memo ?? ''); setShowMakeup(false) }}
                                style={{ background: st.bg, borderLeft: `3px solid ${st.border}`, borderRadius: '0 0.75rem 0.75rem 0', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}>
                                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.875rem', fontWeight: 700, color: st.color, flexShrink: 0, width: '42px' }}>{fmtTime(s.scheduled_at)}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#111827' }}>{s.lesson_plan?.member?.name}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{s.duration_minutes}분 · {s.lesson_plan?.lesson_type}</div>
                                </div>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: '9999px', background: `${st.border}33`, color: st.color, flexShrink: 0 }}>{st.label}</span>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      <CoachBottomNav />

      {/* 수업 처리 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setMemo(''); setShowMakeup(false) } }}>
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
                { status: 'completed', label: '✅ 완료',  bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
                { status: 'absent',    label: '❌ 결석',  bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
                { status: 'makeup',    label: '🔁 보강',  bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
                { status: 'scheduled', label: '🔄 예정',  bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
              ].map(btn => (
                <button key={btn.status} onClick={() => handleStatus(btn.status)} disabled={saving}
                  style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${btn.border}`, background: btn.bg, color: btn.color, fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {btn.label}
                </button>
              ))}
            </div>
            {showMakeup && (
              <div style={{ marginTop: '1rem', background: '#fdf4ff', border: '1.5px solid #c084fc', borderRadius: '0.875rem', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#7e22ce', marginBottom: '0.75rem', fontSize: '0.875rem' }}>📅 보강 날짜 선택</div>
                <input type="date" value={makeupDate} onChange={e => setMakeupDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e9d5ff', borderRadius: '0.5rem', marginBottom: '0.5rem', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', boxSizing: 'border-box' as const }} />
                <input type="time" value={makeupTime} onChange={e => setMakeupTime(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e9d5ff', borderRadius: '0.5rem', marginBottom: '0.75rem', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', boxSizing: 'border-box' as const }} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowMakeup(false)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', background: 'white', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem' }}>취소</button>
                  <button onClick={handleMakeupSubmit} disabled={!makeupDate || !makeupTime || saving}
                    style={{ flex: 1, padding: '0.625rem', border: 'none', borderRadius: '0.625rem', background: (!makeupDate || !makeupTime || saving) ? '#d1d5db' : '#7e22ce', color: 'white', cursor: (!makeupDate || !makeupTime || saving) ? 'not-allowed' : 'pointer', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem' }}>
                    보강 확정
                  </button>
                </div>
              </div>
            )}
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