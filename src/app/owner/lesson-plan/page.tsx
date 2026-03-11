'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Coach   { id: string; name: string }
interface Month   { id: string; year: number; month: number }
interface Member  { id: string; name: string; phone: string }
interface Program { id: string; name: string; unit_minutes: number }
interface Schedule { datetime: string; duration: number }

const DAYS = ['일','월','화','수','목','금','토']

export default function LessonPlanCreatePage() {
  const router = useRouter()

  const [coaches,  setCoaches]  = useState<Coach[]>([])
  const [months,   setMonths]   = useState<Month[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const [memberId,       setMemberId]       = useState('')
  const [memberSearch,   setMemberSearch]   = useState('')
  const [showMemberDrop, setShowMemberDrop] = useState(false)
  const memberRef = useRef<HTMLDivElement>(null)

  const [coachId,     setCoachId]     = useState('')
  const [monthId,     setMonthId]     = useState('')
  const [programId,   setProgramId]   = useState('')
  const [lessonType,  setLessonType]  = useState('')
  const [unitMinutes, setUnitMinutes] = useState(60)
  const [amount,      setAmount]      = useState(0)
  const [payment,     setPayment]     = useState<'unpaid'|'paid'>('unpaid')

  // 일정 자동생성 관련
  const [startDate,    setStartDate]    = useState('')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [time,         setTime]         = useState('09:00')
  const [count,        setCount]        = useState(8)
  const [schedules,    setSchedules]    = useState<Schedule[]>([])
  const [editIdx,      setEditIdx]      = useState<number|null>(null)
  const [editTime,     setEditTime]     = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/coaches').then(r => r.json()),
      fetch('/api/months').then(r => r.json()),
      fetch('/api/members').then(r => r.json()),
      fetch('/api/programs').then(r => r.json()),
    ]).then(([c, m, mem, p]) => {
      setCoaches(Array.isArray(c) ? c : [])
      const mList = Array.isArray(m) ? m : []
      setMonths(mList)
      if (mList.length > 0) setMonthId(mList[0].id)
      setMembers(Array.isArray(mem) ? mem : [])
      setPrograms(Array.isArray(p) ? p : [])
    })
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) {
        setShowMemberDrop(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredMembers = memberSearch
    ? members.filter(m => m.name.includes(memberSearch) || m.phone.includes(memberSearch))
    : members

  const handleProgramSelect = (p: Program) => {
    setProgramId(p.id)
    setLessonType(p.name)
    setUnitMinutes(p.unit_minutes || 60)
  }

  const toggleDay = (d: number) =>
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const generateSchedules = () => {
    if (!startDate || !selectedDays.length) return
    const result: Schedule[] = []
    const cur = new Date(startDate)
    let cnt = 0
    while (cnt < count) {
      if (selectedDays.includes(cur.getDay())) {
        const dt = `${cur.toISOString().split('T')[0]}T${time}:00+09:00`
        result.push({ datetime: dt, duration: unitMinutes })
        cnt++
      }
      cur.setDate(cur.getDate() + 1)
    }
    setSchedules(result)
  }

  const removeSlot = (i: number) => setSchedules(prev => prev.filter((_, idx) => idx !== i))

  const startEdit = (i: number) => {
    const d = new Date(schedules[i].datetime)
    setEditTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`)
    setEditIdx(i)
  }

  const saveEdit = (i: number) => {
    setSchedules(prev => prev.map((s, idx) => {
      if (idx !== i) return s
      const d = new Date(s.datetime)
      const [h, m] = editTime.split(':').map(Number)
      d.setHours(h, m, 0, 0)
      const ymd = d.toISOString().split('T')[0]
      return { ...s, datetime: `${ymd}T${editTime}:00+09:00` }
    }))
    setEditIdx(null)
  }

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const handleSubmit = async () => {
    setError('')
    if (!memberId || !coachId || !monthId) {
      setError('회원, 코치, 수업월을 선택해주세요'); return
    }
    if (!schedules.length) {
      setError('수업 일정을 생성해주세요'); return
    }
    setSaving(true)
    const res = await fetch('/api/lesson-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: memberId,
        coach_id: coachId,
        month_id: monthId,
        lesson_type: lessonType || '개인레슨',
        unit_minutes: unitMinutes,
        schedules,
        amount,
        payment_status: payment,
      }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error || '등록 실패'); return }
    router.replace('/owner/planlist')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.875rem',
    borderRadius: '0.625rem', border: '1.5px solid #e5e7eb',
    fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif',
    outline: 'none', boxSizing: 'border-box', background: 'white',
  }
  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: '1rem',
    border: '1.5px solid #f3f4f6', padding: '1.25rem',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 700, color: '#6b7280',
    display: 'block', marginBottom: '6px',
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>스케줄 등록</h1>
          <Link href="/owner/planlist" style={{ fontSize: '0.8rem', color: '#6b7280', textDecoration: 'none', fontFamily: 'Noto Sans KR, sans-serif' }}>플랜 목록 →</Link>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.25rem 1.5rem 4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ── 기본 정보 ── */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>기본 정보</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            {/* 회원 검색 */}
            <div ref={memberRef} style={{ position: 'relative' }}>
              <label style={labelStyle}>회원 검색</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="이름 또는 전화번호 검색"
                  value={memberSearch}
                  onChange={e => { setMemberSearch(e.target.value); setMemberId(''); setShowMemberDrop(true) }}
                  onFocus={() => setShowMemberDrop(true)}
                  style={{ ...inputStyle, paddingRight: '2.5rem' }}
                />
                {memberId && (
                  <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#16A34A', fontSize: '1rem' }}>✓</span>
                )}
              </div>
              {showMemberDrop && filteredMembers.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                  {filteredMembers.map(m => (
                    <div key={m.id}
                      onClick={() => { setMemberId(m.id); setMemberSearch(`${m.name} (${m.phone})`); setShowMemberDrop(false) }}
                      style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', fontSize: '0.875rem', color: '#374151', borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                    >
                      <span style={{ fontWeight: 600 }}>{m.name}</span>
                      <span style={{ color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.8rem' }}>{m.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 코치 선택 */}
            <div>
              <label style={labelStyle}>코치 선택</label>
              <select value={coachId} onChange={e => setCoachId(e.target.value)} style={inputStyle}>
                <option value="">코치를 선택해주세요</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
              </select>
            </div>

            {/* 수업 월 */}
            <div>
              <label style={labelStyle}>수업 월</label>
              <select value={monthId} onChange={e => setMonthId(e.target.value)} style={inputStyle}>
                {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── 수업 설정 ── */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업 설정</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            {/* 프로그램 */}
            {programs.length > 0 && (
              <div>
                <label style={labelStyle}>프로그램</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {programs.map(p => (
                    <button key={p.id} onClick={() => handleProgramSelect(p)}
                      style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', border: `1.5px solid ${programId === p.id ? '#16A34A' : '#e5e7eb'}`, background: programId === p.id ? '#f0fdf4' : 'white', color: programId === p.id ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 수업 종류 직접입력 */}
            <div>
              <label style={labelStyle}>수업 종류</label>
              <input type="text" value={lessonType} onChange={e => setLessonType(e.target.value)}
                placeholder="개인레슨, 그룹레슨 등" style={inputStyle} />
            </div>

            {/* 회당 시간 */}
            <div>
              <label style={labelStyle}>회당 시간</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[30, 45, 60, 90].map(u => (
                  <button key={u} onClick={() => setUnitMinutes(u)}
                    style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.625rem', border: `1.5px solid ${unitMinutes === u ? '#16A34A' : '#e5e7eb'}`, background: unitMinutes === u ? '#f0fdf4' : 'white', color: unitMinutes === u ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                    {u}분
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 일정 자동 생성 ── */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업 일정 생성</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            {/* 시작 날짜 */}
            <div>
              <label style={labelStyle}>시작 날짜</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            </div>

            {/* 수업 요일 */}
            <div>
              <label style={labelStyle}>수업 요일</label>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.625rem', border: `1.5px solid ${selectedDays.includes(i) ? '#16A34A' : '#e5e7eb'}`, background: selectedDays.includes(i) ? '#f0fdf4' : 'white', color: selectedDays.includes(i) ? '#16A34A' : '#9ca3af', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* 수업 시간 + 총 횟수 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>수업 시간</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>총 수업 횟수</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => setCount(c => Math.max(1, c - 1))}
                    style={{ width: '36px', height: '36px', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>−</button>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#16A34A', minWidth: '32px', textAlign: 'center' }}>{count}</span>
                  <button onClick={() => setCount(c => c + 1)}
                    style={{ width: '36px', height: '36px', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>+</button>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>회</span>
                </div>
              </div>
            </div>

            {/* 자동 생성 버튼 */}
            <button onClick={generateSchedules} disabled={!startDate || !selectedDays.length}
              style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Noto Sans KR, sans-serif', cursor: (!startDate || !selectedDays.length) ? 'not-allowed' : 'pointer', background: (!startDate || !selectedDays.length) ? '#e5e7eb' : '#1d4ed8', color: (!startDate || !selectedDays.length) ? '#9ca3af' : 'white' }}>
              📅 일정 자동 생성
            </button>

            {/* 생성된 일정 목록 */}
            {schedules.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
                  생성된 일정 <span style={{ color: '#16A34A' }}>({schedules.length}회)</span>
                  <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: '0.5rem' }}>✏️ 시간수정 · 🗑️ 삭제 가능</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '2px' }}>
                  {schedules.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16A34A', minWidth: '28px' }}>{i+1}회</span>

                      {editIdx === i ? (
                        <>
                          <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                            style={{ flex: 1, fontSize: '0.85rem', border: '1.5px solid #3b82f6', borderRadius: '0.375rem', padding: '2px 6px', fontFamily: 'Noto Sans KR, sans-serif' }} />
                          <button onClick={() => saveEdit(i)}
                            style={{ fontSize: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.375rem', padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif' }}>저장</button>
                          <button onClick={() => setEditIdx(null)}
                            style={{ fontSize: '0.75rem', background: '#e5e7eb', color: '#6b7280', border: 'none', borderRadius: '0.375rem', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.85rem', color: '#374151', flex: 1 }}>{fmtDt(s.datetime)}</span>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginRight: '0.25rem' }}>{s.duration}분</span>
                          <button onClick={() => startEdit(i)} title="시간 수정"
                            style={{ fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px', color: '#6b7280', lineHeight: 1 }}>✏️</button>
                          <button onClick={() => { if (confirm(`${fmtDt(s.datetime)} 일정을 삭제할까요?`)) removeSlot(i) }} title="삭제"
                            style={{ fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px', color: '#ef4444', lineHeight: 1 }}>🗑️</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 결제 정보 ── */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>결제 정보</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={labelStyle}>수업료 (원)</label>
              <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
                placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>결제 상태</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['unpaid', 'paid'] as const).map(s => (
                  <button key={s} onClick={() => setPayment(s)}
                    style={{ flex: 1, padding: '0.625rem', borderRadius: '0.625rem', border: `1.5px solid ${payment === s ? (s === 'paid' ? '#16A34A' : '#dc2626') : '#e5e7eb'}`, background: payment === s ? (s === 'paid' ? '#f0fdf4' : '#fef2f2') : 'white', color: payment === s ? (s === 'paid' ? '#16A34A' : '#dc2626') : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {s === 'paid' ? '납부' : '미납'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', fontSize: '0.875rem', color: '#b91c1c', fontFamily: 'Noto Sans KR, sans-serif' }}>
            ⚠️ {error}
          </div>
        )}

        {/* 등록 버튼 */}
        <button onClick={handleSubmit} disabled={saving || !memberId || !coachId || !monthId || !schedules.length}
          style={{ padding: '1rem', borderRadius: '0.875rem', border: 'none', fontWeight: 700, fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif', cursor: (saving || !memberId || !coachId || !monthId || !schedules.length) ? 'not-allowed' : 'pointer', background: (saving || !memberId || !coachId || !monthId || !schedules.length) ? '#e5e7eb' : '#16A34A', color: (saving || !memberId || !coachId || !monthId || !schedules.length) ? '#9ca3af' : 'white' }}>
          {saving ? '등록 중...' : `🎾 스케줄 등록 (${schedules.length}회)`}
        </button>
      </div>
    </div>
  )
}