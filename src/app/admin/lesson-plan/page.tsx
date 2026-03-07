'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Profile  { id: string; name: string }
interface Month    { id: string; year: number; month: number }
interface Program  { id: string; name: string; ratio: string; max_students: number; unit_minutes: number }
interface FamilyMember { id: string; name: string; account_id: string }
interface Schedule { datetime: string; duration: number }

const DAYS = ['일','월','화','수','목','금','토']

export default function LessonPlanPage() {
  const router = useRouter()
  const [members,  setMembers]  = useState<Profile[]>([])
  const [coaches,  setCoaches]  = useState<Profile[]>([])
  const [months,   setMonths]   = useState<Month[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [familyMap, setFamilyMap] = useState<Record<string, FamilyMember[]>>({})

  const [memberId,     setMemberId]     = useState('')
  const [memberName,   setMemberName]   = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [familyId,     setFamilyId]     = useState('')
  const [coachId,      setCoachId]      = useState('')
  const [monthId,      setMonthId]      = useState('')
  const [programId,    setProgramId]    = useState('')
  const [lessonType,   setLessonType]   = useState('')
  const [unitMin,      setUnitMin]      = useState(60)
  const [amount,       setAmount]       = useState('')
  const [startDate,    setStartDate]    = useState('')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [time,         setTime]         = useState('09:00')
  const [count,        setCount]        = useState(8)
  const [schedules,    setSchedules]    = useState<Schedule[]>([])
  const [editIdx,      setEditIdx]      = useState<number|null>(null)
  const [editTime,     setEditTime]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/members').then(r => r.json()).then(d => setMembers(Array.isArray(d) ? d : []))
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
    fetch('/api/months').then(r => r.json()).then(d => setMonths(Array.isArray(d) ? d : []))
    fetch('/api/programs').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d.filter((p: Program) => p) : []
      setPrograms(list)
      const oneOnOne = list.find((p: Program) => p.ratio === '1:1')
      if (oneOnOne) {
        setProgramId(oneOnOne.id)
        setLessonType(oneOnOne.name)
        setUnitMin(oneOnOne.unit_minutes)
      }
    })
  }, [])

  // 외부 클릭시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const handleMemberSelect = async (m: Profile) => {
    setMemberId(m.id)
    setMemberName(m.name)
    setMemberSearch(m.name)
    setShowDropdown(false)
    setFamilyId('')
    if (familyMap[m.id]) return
    const res = await fetch(`/api/family/by-account?account_id=${m.id}`)
    const data = await res.json()
    setFamilyMap(prev => ({ ...prev, [m.id]: Array.isArray(data) ? data : [] }))
  }

  const handleProgramChange = (id: string) => {
    setProgramId(id)
    const prog = programs.find(p => p.id === id)
    if (prog) {
      setLessonType(prog.name)
      setUnitMin(prog.unit_minutes)
    }
  }

  const generateSchedules = () => {
    if (!startDate || !selectedDays.length || !count) return
    const result: Schedule[] = []
    const cur = new Date(startDate)
    let cnt = 0
    while (cnt < count) {
      if (selectedDays.includes(cur.getDay())) {
        const dt = `${cur.toISOString().split('T')[0]}T${time}:00+09:00`
        result.push({ datetime: dt, duration: unitMin })
        cnt++
      }
      cur.setDate(cur.getDate() + 1)
    }
    setSchedules(result)
  }

  const handleSubmit = async () => {
    setError('')
    if (!memberId || !coachId || !monthId) return setError('회원, 코치, 수업월을 선택해주세요')
    if (!schedules.length) return setError('수업 일정을 생성해주세요')
    setSaving(true)
    const res = await fetch('/api/lesson-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: memberId,
        family_member_id: familyId || null,
        coach_id: coachId,
        month_id: monthId,
        program_id: programId || null,
        lesson_type: lessonType,
        unit_minutes: unitMin,
        schedules,
        amount: Number(amount) || 0,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setError(data.error)
    router.replace('/owner/schedule')
  }

  const toggleDay = (d: number) => setSelectedDays(prev =>
    prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
  )
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

  const currentFamily = familyMap[memberId] ?? []

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb',
    borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif',
    color: '#111827', background: 'white', boxSizing: 'border-box' as const, outline: 'none',
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner/admin" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>레슨 플랜 등록</h1>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* 기본 정보 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>기본 정보</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 프로그램</label>
              <select style={inputStyle} value={programId} onChange={e => handleProgramChange(e.target.value)}>
                <option value="">직접 입력</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.ratio}) · {p.unit_minutes}분</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>레슨 유형 이름</label>
              <input style={inputStyle} placeholder="개인레슨, 그룹레슨 등" value={lessonType} onChange={e => setLessonType(e.target.value)} />
            </div>

            {/* 회원 검색 */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>회원 검색</label>
              <div ref={searchRef} style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: memberId ? '2.5rem' : '0.75rem' }}
                  placeholder="이름으로 검색..."
                  value={memberSearch}
                  onChange={e => {
                    setMemberSearch(e.target.value)
                    setMemberId('')
                    setMemberName('')
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
                {memberId && (
                  <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#16A34A', fontSize: '1rem' }}>✓</span>
                )}
                {showDropdown && memberSearch && filteredMembers.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto', marginTop: '2px',
                  }}>
                    {filteredMembers.map(m => (
                      <div
                        key={m.id}
                        onMouseDown={() => handleMemberSelect(m)}
                        style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', fontSize: '0.875rem', color: '#111827', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
                        {m.name}
                      </div>
                    ))}
                  </div>
                )}
                {showDropdown && memberSearch && filteredMembers.length === 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem',
                    padding: '0.75rem', fontSize: '0.875rem', color: '#9ca3af', marginTop: '2px',
                  }}>
                    검색 결과 없음
                  </div>
                )}
              </div>
            </div>

            {memberId && currentFamily.length > 0 && (
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>가족구성원 (선택)</label>
                <select style={inputStyle} value={familyId} onChange={e => setFamilyId(e.target.value)}>
                  <option value="">본인</option>
                  {currentFamily.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>코치</label>
              <select style={inputStyle} value={coachId} onChange={e => setCoachId(e.target.value)}>
                <option value="">선택해주세요</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업월</label>
              <select style={inputStyle} value={monthId} onChange={e => setMonthId(e.target.value)}>
                <option value="">선택해주세요</option>
                {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수강료 (원)</label>
              <input style={inputStyle} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>

        {/* 수업 시간 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업 시간 (분)</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[30,45,60,90].map(u => (
              <button key={u} onClick={() => setUnitMin(u)}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', border: `1.5px solid ${unitMin === u ? '#16A34A' : '#e5e7eb'}`, background: unitMin === u ? '#f0fdf4' : 'white', color: unitMin === u ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                {u}분
              </button>
            ))}
            <input type="number" placeholder="직접입력" value={[30,45,60,90].includes(unitMin) ? '' : unitMin}
              onChange={e => setUnitMin(Number(e.target.value))}
              style={{ width: '90px', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', fontSize: '0.85rem' }} />
          </div>
        </div>

        {/* 일정 생성 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업 일정 생성</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>시작 날짜</label>
              <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 요일</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.625rem', border: `1.5px solid ${selectedDays.includes(i) ? '#16A34A' : '#e5e7eb'}`, background: selectedDays.includes(i) ? '#f0fdf4' : 'white', color: selectedDays.includes(i) ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>기본 시간</label>
                <input type="time" style={inputStyle} value={time} onChange={e => setTime(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>횟수</label>
                <input type="number" style={inputStyle} value={count} onChange={e => setCount(Number(e.target.value))} min={1} max={50} />
              </div>
            </div>
            <button onClick={generateSchedules}
              style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#1d4ed8', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              📅 일정 자동 생성
            </button>
          </div>
        </div>

        {/* 생성된 일정 */}
        {schedules.length > 0 && (
          <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>생성된 일정</h2>
              <span style={{ marginLeft: '0.5rem', background: '#f0fdf4', color: '#16A34A', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>{schedules.length}회</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#9ca3af' }}>✏️ 누르면 시간 수정 가능</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
              {schedules.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem', background: editIdx === i ? '#eff6ff' : '#f9fafb', borderRadius: '0.625rem', border: `1.5px solid ${editIdx === i ? '#3b82f6' : 'transparent'}` }}>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginRight: '0.5rem', minWidth: '18px' }}>{i+1}</span>
                  {editIdx === i ? (
                    <>
                      <span style={{ fontSize: '0.82rem', color: '#374151', flex: 1 }}>{fmtDt(s.datetime).split(' ')[0]}</span>
                      <input
                        type="time" value={editTime} onChange={e => setEditTime(e.target.value)} autoFocus
                        style={{ padding: '0.25rem 0.5rem', border: '1.5px solid #3b82f6', borderRadius: '0.5rem', fontSize: '0.82rem', width: '100px' }}
                      />
                      <button onClick={() => saveEdit(i)} style={{ marginLeft: '0.5rem', padding: '0.25rem 0.625rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}>저장</button>
                      <button onClick={() => setEditIdx(null)} style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>취소</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: '0.85rem', color: '#374151' }}>{fmtDt(s.datetime)} · {s.duration}분</span>
                      <button onClick={() => startEdit(i)} style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0 4px' }}>✏️</button>
                      <button onClick={() => removeSlot(i)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}>✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.875rem 1rem', color: '#b91c1c', fontSize: '0.875rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={saving}
          style={{ padding: '1rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif', opacity: saving ? 0.7 : 1 }}>
          {saving ? '등록 중...' : '레슨 플랜 등록'}
        </button>
      </div>
    </div>
  )
}