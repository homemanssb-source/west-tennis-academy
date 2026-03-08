'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

interface Coach  { id: string; name: string }
interface Month  { id: string; year: number; month: number }
interface MyApp  {
  id: string; requested_at: string; duration_minutes: number
  lesson_type: string; status: string; coach_note: string | null; admin_note: string | null
  coach: { name: string }; month: { year: number; month: number }
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending_coach: { label: '코치 확인 중', color: '#854d0e', bg: '#fef9c3' },
  pending_admin: { label: '승인 대기',   color: '#1d4ed8', bg: '#eff6ff' },
  approved:      { label: '확정',        color: '#15803d', bg: '#dcfce7' },
  rejected:      { label: '거절',        color: '#b91c1c', bg: '#fee2e2' },
}

const DAYS = ['일','월','화','수','목','금','토']

export default function MemberApplyPage() {
  const [coaches,  setCoaches]  = useState<Coach[]>([])
  const [months,   setMonths]   = useState<Month[]>([])
  const [myApps,   setMyApps]   = useState<MyApp[]>([])
  const [tab,      setTab]      = useState<'new'|'list'>('new')
  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(true)

  const [coachId,  setCoachId]  = useState('')
  const [monthId,  setMonthId]  = useState('')
  const [date,     setDate]     = useState('')
  const [time,     setTime]     = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [lessonType, setLessonType] = useState('개인레슨')

  // 빈 슬롯 확인용 (선택된 날짜의 기존 수업)
  const [busyTimes, setBusyTimes] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
    fetch('/api/months').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : []
      setMonths(list)
      if (list.length > 0) setMonthId(list[0].id)
    })
    loadMyApps()
  }, [])

  const loadMyApps = async () => {
    setLoading(true)
    const res = await fetch('/api/lesson-applications')
    const d = await res.json()
    setMyApps(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  // 날짜/코치 선택 시 해당 날의 기존 수업 조회
  useEffect(() => {
    if (!date || !coachId) { setBusyTimes([]); return }
    fetch(`/api/lesson-slots?date=${date}&coach_id=${coachId}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setBusyTimes(d.map((s: any) => {
            const dt = new Date(s.scheduled_at)
            return `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
          }))
        }
      })
  }, [date, coachId])

  const handleSubmit = async () => {
    if (!coachId || !monthId || !date || !time) {
      alert('모든 항목을 입력해주세요')
      return
    }
    if (busyTimes.includes(time)) {
      alert('해당 시간은 이미 수업이 있습니다. 다른 시간을 선택해주세요.')
      return
    }
    setSaving(true)
    const requested_at = `${date}T${time}:00+09:00`
    const res = await fetch('/api/lesson-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coach_id: coachId, month_id: monthId, requested_at, duration_minutes: duration, lesson_type: lessonType }),
    })
    const d = await res.json()
    setSaving(false)
    if (d.error) { alert(d.error); return }
    alert('신청되었습니다! 코치 확인 후 안내드립니다.')
    setTab('list')
    loadMyApps()
  }

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb',
    borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif',
    color: '#111827', background: 'white', boxSizing: 'border-box' as const, outline: 'none',
  }

  // 시간 슬롯 (07:00 ~ 21:00, 30분 간격)
  const timeSlots: string[] = []
  for (let h = 7; h <= 21; h++) {
    timeSlots.push(`${String(h).padStart(2,'0')}:00`)
    if (h < 21) timeSlots.push(`${String(h).padStart(2,'0')}:30`)
  }

  return (
    <div className="mobile-wrap" style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>수업 신청</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['new','list'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 700, fontSize: '0.85rem',
                background: tab === t ? '#16A34A' : '#f3f4f6',
                color: tab === t ? 'white' : '#6b7280' }}>
              {t === 'new' ? '+ 새 신청' : `내 신청 ${myApps.length > 0 ? `(${myApps.length})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '1.25rem', paddingBottom: '6rem' }}>

        {/* 새 신청 */}
        {tab === 'new' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업 정보</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>코치 선택</label>
                  <select style={inputStyle} value={coachId} onChange={e => setCoachId(e.target.value)}>
                    <option value="">코치를 선택하세요</option>
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 월</label>
                  <select style={inputStyle} value={monthId} onChange={e => setMonthId(e.target.value)}>
                    {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>레슨 유형</label>
                  <input style={inputStyle} value={lessonType} onChange={e => setLessonType(e.target.value)} placeholder="개인레슨" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 시간</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[30,45,60,90].map(u => (
                      <button key={u} onClick={() => setDuration(u)}
                        style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.625rem',
                          border: `1.5px solid ${duration === u ? '#16A34A' : '#e5e7eb'}`,
                          background: duration === u ? '#f0fdf4' : 'white',
                          color: duration === u ? '#16A34A' : '#6b7280',
                          fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                        {u}분
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 날짜/시간 선택 */}
            <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>희망 날짜 · 시간</h2>
              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>날짜</label>
                <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
              </div>

              {/* 시간 슬롯 그리드 */}
              {date && coachId && (
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '8px' }}>
                    시간 선택
                    <span style={{ marginLeft: '8px', fontSize: '0.7rem', fontWeight: 400 }}>
                      <span style={{ color: '#15803d' }}>● 가능</span>
                      <span style={{ color: '#b91c1c', marginLeft: '6px' }}>● 불가</span>
                    </span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
                    {timeSlots.map(t => {
                      const busy = busyTimes.includes(t)
                      const selected = time === t
                      return (
                        <button key={t} onClick={() => !busy && setTime(t)} disabled={busy}
                          style={{
                            padding: '0.5rem 0', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer',
                            border: selected ? '2px solid #16A34A' : `1.5px solid ${busy ? '#fecaca' : '#e5e7eb'}`,
                            background: selected ? '#f0fdf4' : busy ? '#fef2f2' : 'white',
                            color: selected ? '#15803d' : busy ? '#fca5a5' : '#374151',
                          }}>
                          {t}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>
                    선택: <strong style={{ color: '#111827' }}>{date} {time}</strong>
                    {busyTimes.includes(time) && <span style={{ color: '#b91c1c', marginLeft: '6px' }}>⚠️ 이미 수업 있음</span>}
                  </div>
                </div>
              )}
              {(!date || !coachId) && (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', fontSize: '0.875rem', background: '#f9fafb', borderRadius: '0.75rem' }}>
                  코치와 날짜를 먼저 선택해주세요
                </div>
              )}
            </div>

            <button onClick={handleSubmit} disabled={saving || !coachId || !date || busyTimes.includes(time)}
              style={{
                padding: '1rem', borderRadius: '0.875rem', border: 'none', fontWeight: 700, fontSize: '1rem',
                fontFamily: 'Noto Sans KR, sans-serif', cursor: 'pointer',
                background: (!coachId || !date || busyTimes.includes(time)) ? '#e5e7eb' : '#16A34A',
                color: (!coachId || !date || busyTimes.includes(time)) ? '#9ca3af' : 'white',
              }}>
              {saving ? '신청 중...' : '🎾 수업 신청하기'}
            </button>
          </div>
        )}

        {/* 내 신청 목록 */}
        {tab === 'list' && (
          loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
          ) : myApps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎾</div>
              <p>신청 내역이 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {myApps.map(a => {
                const st = STATUS[a.status] ?? STATUS.pending_coach
                return (
                  <div key={a.id} style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>{a.coach?.name} 코치</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      {fmtDt(a.requested_at)} · {a.duration_minutes}분 · {a.lesson_type}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                      {a.month?.year}년 {a.month?.month}월
                    </div>
                    {a.coach_note && (
                      <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#6b7280', background: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                        코치 메모: {a.coach_note}
                      </div>
                    )}
                    {a.admin_note && (
                      <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#6b7280', background: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                        관리 메모: {a.admin_note}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
