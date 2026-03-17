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

// ✅ KST 기준 today
function getTodayKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

export default function CoachSchedulePage() {
  const today = getTodayKST()

  const [tab,            setTab]            = useState<'day'|'week'>('day')
  const [date,           setDate]           = useState(today)
  const [coachId,        setCoachId]        = useState('')
  const [slots,          setSlots]          = useState<Slot[]>([])
  const [weekSlots,      setWeekSlots]      = useState<Slot[]>([])
  const [loading,        setLoading]        = useState(false)
  const [selected,       setSelected]       = useState<Slot | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [memo,           setMemo]           = useState('')
  const [showMakeup,     setShowMakeup]     = useState(false)
  const [makeupDate,     setMakeupDate]     = useState('')
  const [makeupTime,     setMakeupTime]     = useState('')
  const [weekOffset,     setWeekOffset]     = useState(0)
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')

  useEffect(() => {
    fetch('/api/session').then(r => r.json()).then(d => {
      if (d?.id) setCoachId(d.id)
    })
  }, [])

  const load = useCallback(async () => {
    if (!coachId) return
    setLoading(true)
    const res = await fetch(`/api/lesson-slots?date=${date}&coach_id=${coachId}`)
    const data = await res.json()
    setSlots((Array.isArray(data) ? data : []).filter(
      (s: Slot) => s.lesson_plan?.coach?.id === coachId
    ))
    setLoading(false)
  }, [date, coachId])

  const loadWeek = useCallback(async () => {
    if (!coachId) return
    setLoading(true)
    const base = new Date(today)
    base.setDate(base.getDate() + weekOffset * 7)
    const weekDates = getWeekDates(base.toISOString().split('T')[0])
    const res = await fetch(`/api/lesson-slots?from=${weekDates[0]}&to=${weekDates[6]}&coach_id=${coachId}`)
    const data = await res.json()
    setWeekSlots((Array.isArray(data) ? data : []).filter(
      (s: Slot) => s.lesson_plan?.coach?.id === coachId
    ))
    setLoading(false)
  }, [coachId, weekOffset, today])

  useEffect(() => { if (tab === 'day')  load() },     [load, tab])
  useEffect(() => { if (tab === 'week') loadWeek() }, [loadWeek, tab])

  const reload = () => tab === 'day' ? load() : loadWeek()

  const closeModal = () => {
    setSelected(null)
    setMemo('')
    setShowMakeup(false)
    setShowReschedule(false)
  }

  const handleStatus = async (status: string) => {
    if (!selected) return
    if (status === 'makeup') { setShowMakeup(true); setShowReschedule(false); return }
    setSaving(true)
    await fetch(`/api/lesson-slots/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, memo: memo || null }),
    })
    setSaving(false)
    closeModal()
    reload()
  }

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
    closeModal()
    reload()
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
    setMakeupDate('')
    setMakeupTime('')
    closeModal()
    reload()
  }

  const handleRescheduleOpen = () => {
    if (!selected) return
    // 현재 KST 시간을 기본값으로
    const kst = new Date(new Date(selected.scheduled_at).getTime())
    setRescheduleDate(kst.toISOString().split('T')[0])
    setRescheduleTime(`${String(kst.getHours()).padStart(2,'0')}:${String(kst.getMinutes()).padStart(2,'0')}`)
    setShowReschedule(true)
    setShowMakeup(false)
  }

  const handleRescheduleSubmit = async () => {
    if (!selected || !rescheduleDate || !rescheduleTime) return
    setSaving(true)
    const res = await fetch(`/api/lesson-slots/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: `${rescheduleDate}T${rescheduleTime}:00+09:00` }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { alert(data.error ?? '수정에 실패했습니다'); return }
    closeModal()
    reload()
  }

  const fmtTime = (dt: string) => {
    const d = new Date(dt)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
  const changeDate = (days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().split('T')[0])
  }

  const base = new Date(today)
  base.setDate(base.getDate() + weekOffset * 7)
  const weekDates = getWeekDates(base.toISOString().split('T')[0])
  const slotsByDate: Record<string, Slot[]> = {}
  weekDates.forEach(d => { slotsByDate[d] = [] })
  weekSlots.forEach(s => {
    const d = s.scheduled_at.split('T')[0]
    if (slotsByDate[d]) slotsByDate[d].push(s)
  })

  const openSlot = (s: Slot) => {
    setSelected(s)
    setMemo(s.memo ?? '')
    setShowMakeup(false)
    setShowReschedule(false)
  }

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>스케줄</div>

        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
          {(['day','week'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '0.625rem', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', background: tab === t ? '#1d4ed8' : '#f3f4f6', color: tab === t ? 'white' : '#6b7280' }}>
              {t === 'day' ? '📅 일간' : '📆 주간'}
            </button>
          ))}
        </div>

        {tab === 'day' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => changeDate(-1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>‹</button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', textAlign: 'center' }} />
            <button onClick={() => changeDate(1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>›</button>
          </div>
        )}

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

      {/* 본문 */}
      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem', overflowY: 'auto' }}>

        {/* 일간 뷰 */}
        {tab === 'day' && (
          loading
            ? <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
            : slots.length === 0
              ? <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
                  <p style={{ fontSize: '0.875rem' }}>이 날 수업이 없습니다</p>
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {slots.map(s => {
                    const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
                    return (
                      <div key={s.id} onClick={() => openSlot(s)}
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

        {/* 주간 뷰 */}
        {tab === 'week' && (
          loading
            ? <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {weekDates.map(d => {
                  const daySlots = slotsByDate[d] ?? []
                  const dateObj  = new Date(d)
                  const isToday  = d === today
                  const dow      = dateObj.getDay()
                  return (
                    <div key={d}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: isToday ? '#1d4ed8' : '#f3f4f6', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: isToday ? 'rgba(255,255,255,.8)' : dow === 0 ? '#b91c1c' : dow === 6 ? '#1d4ed8' : '#6b7280' }}>{DAY_KO[dow]}</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isToday ? 'white' : dow === 0 ? '#b91c1c' : dow === 6 ? '#1d4ed8' : '#374151', lineHeight: 1 }}>{dateObj.getDate()}</span>
                        </div>
                        <div style={{ flex: 1, height: '1px', background: '#f3f4f6' }} />
                        {daySlots.length > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280' }}>{daySlots.length}건</span>}
                      </div>
                      {daySlots.length === 0
                        ? <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: '#d1d5db' }}>수업 없음</div>
                        : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {daySlots.sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at)).map(s => {
                              const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
                              return (
                                <div key={s.id} onClick={() => openSlot(s)}
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
                      }
                    </div>
                  )
                })}
              </div>
        )}
      </div>

      <CoachBottomNav />

      {/* ── 수업 처리 모달 ── */}
      {selected && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{
            background: 'white',
            width: '100%',
            maxWidth: '390px',
            borderRadius: '1.5rem 1.5rem 0 0',
            padding: '1.25rem 1.25rem 2rem',
            // ✅ 모달 내용 많을 때 스크롤
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            {/* 드래그 핸들 */}
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }} />

            {/* 제목 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>수업 처리</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#9ca3af', cursor: 'pointer', padding: '0 0.25rem' }}>✕</button>
            </div>

            {/* 수업 정보 */}
            <div style={{ background: '#f9fafb', borderRadius: '0.875rem', padding: '0.875rem 1rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{selected.lesson_plan?.member?.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '3px' }}>
                {fmtTime(selected.scheduled_at)} · {selected.duration_minutes}분 · {selected.lesson_plan?.lesson_type}
              </div>
            </div>

            {/* 메모 */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>메모 (선택)</label>
              <input className="input-base" placeholder="특이사항 입력" value={memo} onChange={e => setMemo(e.target.value)} />
            </div>

            {/* 상태 버튼 2x2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {[
                { status: 'completed', label: '✅ 완료',  bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
                { status: 'absent',    label: '❌ 결석',  bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
                { status: 'makeup',    label: '🔁 보강',  bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
                { status: 'scheduled', label: '🔄 예정',  bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
              ].map(btn => (
                <button key={btn.status} onClick={() => handleStatus(btn.status)} disabled={saving}
                  style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${btn.border}`, background: btn.bg, color: btn.color, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', opacity: saving ? 0.6 : 1 }}>
                  {btn.label}
                </button>
              ))}
            </div>

            {/* ✅ 날짜/시간 수정 버튼 (scheduled 상태만) */}
            {selected.status === 'scheduled' && (
              <button onClick={handleRescheduleOpen} disabled={saving}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #fde68a', background: '#fffbeb', color: '#92400e', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                📝 날짜 · 시간 수정
              </button>
            )}

            {/* 날짜/시간 수정 폼 */}
            {showReschedule && (
              <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '0.875rem', padding: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.875rem', fontSize: '0.875rem' }}>📝 수업 일정 수정</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.625rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '4px' }}>날짜</label>
                    <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #fde68a', borderRadius: '0.5rem', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '4px' }}>시간</label>
                    <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #fde68a', borderRadius: '0.5rem', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#92400e', background: '#fef3c7', padding: '0.5rem 0.625rem', borderRadius: '0.5rem', marginBottom: '0.625rem' }}>
                  ⚠️ 수정 시 회원에게 변경 알림이 발송됩니다
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowReschedule(false)}
                    style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', background: 'white', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem' }}>
                    취소
                  </button>
                  <button onClick={handleRescheduleSubmit} disabled={!rescheduleDate || !rescheduleTime || saving}
                    style={{ flex: 1, padding: '0.625rem', border: 'none', borderRadius: '0.625rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', color: 'white', cursor: (!rescheduleDate || !rescheduleTime || saving) ? 'not-allowed' : 'pointer', background: (!rescheduleDate || !rescheduleTime || saving) ? '#d1d5db' : '#d97706' }}>
                    {saving ? '수정 중...' : '수정 확정'}
                  </button>
                </div>
              </div>
            )}

            {/* 보강 폼 */}
            {showMakeup && (
              <div style={{ background: '#fdf4ff', border: '1.5px solid #c084fc', borderRadius: '0.875rem', padding: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: '#7e22ce', marginBottom: '0.875rem', fontSize: '0.875rem' }}>📅 보강 날짜 선택</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.625rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '4px' }}>날짜</label>
                    <input type="date" value={makeupDate} onChange={e => setMakeupDate(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e9d5ff', borderRadius: '0.5rem', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '4px' }}>시간</label>
                    <input type="time" value={makeupTime} onChange={e => setMakeupTime(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e9d5ff', borderRadius: '0.5rem', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowMakeup(false)}
                    style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', background: 'white', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem' }}>
                    취소
                  </button>
                  <button onClick={handleMakeupSubmit} disabled={!makeupDate || !makeupTime || saving}
                    style={{ flex: 1, padding: '0.625rem', border: 'none', borderRadius: '0.625rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', color: 'white', cursor: (!makeupDate || !makeupTime || saving) ? 'not-allowed' : 'pointer', background: (!makeupDate || !makeupTime || saving) ? '#d1d5db' : '#7e22ce' }}>
                    {saving ? '처리 중...' : '보강 확정'}
                  </button>
                </div>
              </div>
            )}

            {/* 수업 취소 버튼 */}
            {selected.status !== 'completed' && (
              <button onClick={handleCancel} disabled={saving}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', opacity: saving ? 0.6 : 1 }}>
                🗑 수업 취소 (회원 알림 발송)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}