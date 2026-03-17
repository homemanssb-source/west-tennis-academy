'use client'
// src/app/admin/lesson-plan/page.tsx
// ✅ 레슨비 자동 계산 + 할인 미리보기 추가 (기존 구조 완전 유지)

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Profile      { id: string; name: string; discount_amount: number; discount_memo: string | null }
interface Month        { id: string; year: number; month: number }
interface Program      {
  id: string; name: string; ratio: string; max_students: number
  unit_minutes: number; default_amount: number; per_session_price: number
}
interface FamilyMember { id: string; name: string; account_id: string }
interface Schedule     { datetime: string; duration: number }
interface WtaConfig    { session_threshold: number; sat_surcharge: number; sun_surcharge: number }

const DAYS = ['일','월','화','수','목','금','토']
const fmt  = (n: number) => `₩${Math.max(0, n || 0).toLocaleString()}`

// ── 금액 계산 함수 (순수) ──────────────────────────────────────────
function calcAmount(opts: {
  config: WtaConfig
  default_amount: number; per_session_price: number
  billing_count: number; sat_count: number; sun_count: number
  discount_amount: number
}) {
  const { config, default_amount, per_session_price, billing_count, sat_count, sun_count, discount_amount } = opts
  const { session_threshold, sat_surcharge, sun_surcharge } = config

  let base_amount: number
  if (billing_count >= session_threshold) {
    const over = billing_count - session_threshold
    base_amount = default_amount + (over > 0 ? over * per_session_price : 0)
  } else {
    base_amount = per_session_price * billing_count
  }

  const sat_extra = sat_count > 0 ? sat_surcharge : 0
  const sun_extra = sun_count > 0 ? sun_surcharge : 0
  const amount    = Math.max(0, base_amount + sat_extra + sun_extra - discount_amount)

  return { base_amount, sat_extra, sun_extra, amount }
}

export default function LessonPlanPage() {
  const router = useRouter()

  const [members,   setMembers]   = useState<Profile[]>([])
  const [coaches,   setCoaches]   = useState<Profile[]>([])
  const [months,    setMonths]    = useState<Month[]>([])
  const [programs,  setPrograms]  = useState<Program[]>([])
  const [familyMap, setFamilyMap] = useState<Record<string, FamilyMember[]>>({})
  const [config,    setConfig]    = useState<WtaConfig>({ session_threshold: 8, sat_surcharge: 0, sun_surcharge: 0 })

  const [memberId,     setMemberId]     = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [familyId,     setFamilyId]     = useState('')
  const [coachId,      setCoachId]      = useState('')
  const [monthId,      setMonthId]      = useState('')
  const [programId,    setProgramId]    = useState('')
  const [lessonType,   setLessonType]   = useState('')
  const [unitMin,      setUnitMin]      = useState(60)
  const [startDate,    setStartDate]    = useState('')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [time,         setTime]         = useState('09:00')
  const [count,        setCount]        = useState(8)
  const [schedules,    setSchedules]    = useState<Schedule[]>([])
  const [editIdx,      setEditIdx]      = useState<number|null>(null)
  const [editTime,     setEditTime]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  // ✅ 레슨비 계산 상태
  const [billingCount,   setBillingCount]   = useState<number | null>(null)
  const [manualAmount,   setManualAmount]   = useState<number | null>(null)
  const [memberDiscount, setMemberDiscount] = useState(0)
  const [discountMemo,   setDiscountMemo]   = useState<string | null>(null)

  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/members').then(r => r.json()),
      fetch('/api/coaches').then(r => r.json()),
      fetch('/api/months').then(r => r.json()),
      fetch('/api/programs').then(r => r.json()),
      fetch('/api/config').then(r => r.json()),
    ]).then(([mem, coa, mon, prg, cfg]) => {
      setMembers(Array.isArray(mem) ? mem : [])
      setCoaches(Array.isArray(coa) ? coa : [])
      setMonths(Array.isArray(mon) ? mon : [])
      const list = Array.isArray(prg) ? prg : []
      setPrograms(list)
      // 1:1 프로그램 기본 선택
      const oneOnOne = list.find((p: Program) => p.ratio === '1:1')
      if (oneOnOne) {
        setProgramId(oneOnOne.id)
        setLessonType(oneOnOne.name)
        setUnitMin(oneOnOne.unit_minutes)
      }
      if (cfg && !cfg.error) setConfig(cfg)
    })
  }, [])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 회원 선택 시 할인 정보 반영
  const handleMemberSelect = async (m: Profile) => {
    setMemberId(m.id)
    setMemberSearch(m.name)
    setShowDropdown(false)
    setFamilyId('')
    setMemberDiscount(m.discount_amount ?? 0)
    setDiscountMemo(m.discount_memo ?? null)
    setManualAmount(null)
    if (familyMap[m.id]) return
    const res  = await fetch(`/api/family/by-account?account_id=${m.id}`)
    const data = await res.json()
    setFamilyMap(prev => ({ ...prev, [m.id]: Array.isArray(data) ? data : [] }))
  }

  const handleProgramChange = (id: string) => {
    setProgramId(id)
    const prog = programs.find(p => p.id === id)
    if (prog) { setLessonType(prog.name); setUnitMin(prog.unit_minutes) }
    setManualAmount(null)
  }

  const generateSchedules = () => {
    if (!startDate || !selectedDays.length || !count) return
    const result: Schedule[] = []
    const cur = new Date(startDate)
    let cnt = 0
    while (cnt < count) {
      if (selectedDays.includes(cur.getDay())) {
        result.push({ datetime: `${cur.toISOString().split('T')[0]}T${time}:00+09:00`, duration: unitMin })
        cnt++
      }
      cur.setDate(cur.getDate() + 1)
    }
    setSchedules(result)
    setBillingCount(null)
    setManualAmount(null)
  }

  const toggleDay = (d: number) =>
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const removeSlot = (i: number) => {
    setSchedules(prev => prev.filter((_, idx) => idx !== i))
    setManualAmount(null)
  }

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
      return { ...s, datetime: `${d.toISOString().split('T')[0]}T${editTime}:00+09:00` }
    }))
    setEditIdx(null)
  }

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  // ── 레슨비 자동 계산 ──────────────────────────────────────────────
  const selectedProgram    = programs.find(p => p.id === programId) ?? null
  const effectiveBilling   = billingCount !== null ? billingCount : schedules.length
  const satCount           = schedules.filter(s => new Date(s.datetime).getDay() === 6).length
  const sunCount           = schedules.filter(s => new Date(s.datetime).getDay() === 0).length

  const autoCalc = selectedProgram && schedules.length > 0
    ? calcAmount({
        config,
        default_amount:    selectedProgram.default_amount,
        per_session_price: selectedProgram.per_session_price,
        billing_count:     effectiveBilling,
        sat_count:         satCount,
        sun_count:         sunCount,
        discount_amount:   memberDiscount,
      })
    : null

  const finalAmount = manualAmount !== null ? manualAmount : (autoCalc?.amount ?? 0)

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const currentFamily = familyMap[memberId] ?? []

  const handleSubmit = async () => {
    setError('')
    if (!memberId || !coachId || !monthId) return setError('회원, 코치, 수업월을 선택해주세요')
    if (!schedules.length) return setError('수업 일정을 생성해주세요')
    setSaving(true)
    const res = await fetch('/api/lesson-plans', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id:       memberId,
        family_member_id: familyId || null,
        coach_id:         coachId,
        month_id:         monthId,
        program_id:       programId || null,
        lesson_type:      lessonType,
        unit_minutes:     unitMin,
        schedules,
        amount:           finalAmount,
        billing_count:    effectiveBilling,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setError(data.error)
    router.replace('/owner/schedule')
  }

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb',
    borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif',
    color: '#111827', background: 'white', boxSizing: 'border-box' as const, outline: 'none',
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner/admin" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>레슨 플랜 등록</h1>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ── 기본 정보 ─────────────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>기본 정보</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            {/* 수업 프로그램 */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 프로그램</label>
              <select style={inputStyle} value={programId} onChange={e => handleProgramChange(e.target.value)}>
                <option value="">직접 입력</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.ratio}) · {p.unit_minutes}분
                    {p.default_amount > 0 ? ` · 월정액 ${p.default_amount.toLocaleString()}원` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 레슨 유형 이름 */}
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
                  onChange={e => { setMemberSearch(e.target.value); setMemberId(''); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                />
                {memberId && (
                  <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#16A34A' }}>✓</span>
                )}
                {showDropdown && memberSearch && filteredMembers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto', marginTop: '2px' }}>
                    {filteredMembers.map(m => (
                      <div key={m.id} onMouseDown={() => handleMemberSelect(m)}
                        style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', fontSize: '0.875rem', color: '#111827', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        <span>{m.name}</span>
                        {(m.discount_amount ?? 0) > 0 && (
                          <span style={{ fontSize: '0.7rem', color: '#7e22ce', fontWeight: 700 }}>
                            할인 {(m.discount_amount ?? 0).toLocaleString()}원
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {showDropdown && memberSearch && filteredMembers.length === 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', padding: '0.75rem', fontSize: '0.875rem', color: '#9ca3af', marginTop: '2px' }}>
                    검색 결과 없음
                  </div>
                )}
              </div>
              {/* ✅ 할인 배지 */}
              {memberId && memberDiscount > 0 && (
                <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#7e22ce', fontWeight: 700 }}>
                  💸 할인 적용: −{memberDiscount.toLocaleString()}원
                  {discountMemo && ` (${discountMemo})`}
                </div>
              )}
            </div>

            {/* 가족 구성원 */}
            {memberId && currentFamily.length > 0 && (
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>가족구성원 (선택)</label>
                <select style={inputStyle} value={familyId} onChange={e => setFamilyId(e.target.value)}>
                  <option value="">본인</option>
                  {currentFamily.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}

            {/* 코치 */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>코치</label>
              <select style={inputStyle} value={coachId} onChange={e => setCoachId(e.target.value)}>
                <option value="">선택해주세요</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
              </select>
            </div>

            {/* 수업월 */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업월</label>
              <select style={inputStyle} value={monthId} onChange={e => setMonthId(e.target.value)}>
                <option value="">선택해주세요</option>
                {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
              </select>
            </div>

          </div>
        </div>

        {/* ── 수업 시간 ─────────────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업 시간 (분)</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[30, 45, 60, 90].map(u => (
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

        {/* ── 일정 생성 ─────────────────────────────────────────────── */}
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
                    style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.625rem', border: `1.5px solid ${selectedDays.includes(i) ? (i===0?'#dc2626':i===6?'#d97706':'#16A34A') : '#e5e7eb'}`, background: selectedDays.includes(i) ? (i===0?'#fef2f2':i===6?'#fffbeb':'#f0fdf4') : 'white', color: selectedDays.includes(i) ? (i===0?'#dc2626':i===6?'#d97706':'#16A34A') : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                    {d}
                  </button>
                ))}
              </div>
              {selectedProgram && (selectedDays.includes(0) || selectedDays.includes(6)) && (
                <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>
                  ⚠️ 주말 선택됨
                  {selectedDays.includes(6) && config.sat_surcharge > 0 && ` · 토요일 +${config.sat_surcharge.toLocaleString()}원`}
                  {selectedDays.includes(0) && config.sun_surcharge > 0 && ` · 일요일 +${config.sun_surcharge.toLocaleString()}원`}
                </div>
              )}
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
              {schedules.map((s, i) => {
                const dow = new Date(s.datetime).getDay()
                const isWeekend = dow === 0 || dow === 6
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem', background: editIdx === i ? '#eff6ff' : isWeekend ? '#fffbeb' : '#f9fafb', borderRadius: '0.625rem', border: `1.5px solid ${editIdx === i ? '#3b82f6' : isWeekend ? '#fde68a' : 'transparent'}` }}>
                    <span style={{ fontSize: '0.8rem', color: isWeekend ? '#d97706' : '#9ca3af', marginRight: '0.5rem', minWidth: '18px' }}>{i+1}</span>
                    {editIdx === i ? (
                      <>
                        <span style={{ fontSize: '0.82rem', color: '#374151', flex: 1 }}>{fmtDt(s.datetime).split(' ')[0]}</span>
                        <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} autoFocus
                          style={{ padding: '0.25rem 0.5rem', border: '1.5px solid #3b82f6', borderRadius: '0.5rem', fontSize: '0.82rem', width: '100px' }} />
                        <button onClick={() => saveEdit(i)} style={{ marginLeft: '0.5rem', padding: '0.25rem 0.625rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}>저장</button>
                        <button onClick={() => setEditIdx(null)} style={{ marginLeft: '0.25rem', padding: '0.25rem 0.5rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>취소</button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontSize: '0.85rem', color: '#374151' }}>{fmtDt(s.datetime)} · {s.duration}분</span>
                        {isWeekend && <span style={{ fontSize: '0.65rem', color: '#d97706', fontWeight: 700, marginRight: '4px' }}>주말</span>}
                        <button onClick={() => startEdit(i)} style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0 4px' }}>✏️</button>
                        <button onClick={() => removeSlot(i)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}>✕</button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ✅ 레슨비 미리보기 */}
        {selectedProgram && schedules.length > 0 && (
          <div style={{ background: 'white', border: '1.5px solid #dbeafe', borderRadius: '1rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span>💰</span>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#1e40af' }}>레슨비 미리보기</span>
              {manualAmount !== null && (
                <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', borderRadius: '999px', padding: '2px 8px', fontWeight: 700 }}>수동 입력</span>
              )}
            </div>

            {/* 계산 내역 */}
            {autoCalc && (
              <div style={{ marginBottom: '0.875rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#4b5563' }}>
                    기본금액
                    <span style={{ color: '#9ca3af', fontSize: '0.72rem', marginLeft: '4px' }}>
                      ({effectiveBilling >= config.session_threshold
                        ? effectiveBilling === config.session_threshold ? '월정액' : `월정액 + ${effectiveBilling - config.session_threshold}회 초과`
                        : `${selectedProgram.per_session_price.toLocaleString()}원 × ${effectiveBilling}회`})
                    </span>
                  </span>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700 }}>{fmt(autoCalc.base_amount)}</span>
                </div>
                {autoCalc.sat_extra > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#4b5563' }}>토요일 추가금 <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>({satCount}회)</span></span>
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#d97706' }}>+{fmt(autoCalc.sat_extra)}</span>
                  </div>
                )}
                {autoCalc.sun_extra > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#4b5563' }}>일요일 추가금 <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>({sunCount}회)</span></span>
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#d97706' }}>+{fmt(autoCalc.sun_extra)}</span>
                  </div>
                )}
                {memberDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#4b5563' }}>
                      회원 할인
                      {discountMemo && <span style={{ color: '#9ca3af', fontSize: '0.72rem', marginLeft: '4px' }}>({discountMemo})</span>}
                    </span>
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#7e22ce' }}>−{fmt(memberDiscount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* 최종 금액 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: manualAmount !== null ? '#fffbeb' : '#eff6ff', borderRadius: '0.75rem', border: `1.5px solid ${manualAmount !== null ? '#fde68a' : '#bfdbfe'}`, marginBottom: '0.875rem' }}>
              <span style={{ fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>최종 레슨비</span>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#1e40af' }}>{fmt(finalAmount)}</span>
            </div>

            {/* 청구 횟수 조정 */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>청구 횟수 조정 <span style={{ fontWeight: 400, color: '#9ca3af' }}>(서비스 제외 시 줄이기)</span></span>
                {billingCount !== null && (
                  <button onClick={() => { setBillingCount(null); setManualAmount(null) }} style={{ fontSize: '0.7rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>↺ 자동 ({schedules.length}회)</button>
                )}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => { setBillingCount(Math.max(0, effectiveBilling - 1)); setManualAmount(null) }}
                  style={{ width: '36px', height: '36px', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb', background: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>−</button>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: effectiveBilling !== schedules.length ? '#7e22ce' : '#111827', minWidth: '40px', textAlign: 'center' }}>{effectiveBilling}</span>
                <button onClick={() => { setBillingCount(effectiveBilling + 1); setManualAmount(null) }}
                  style={{ width: '36px', height: '36px', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb', background: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>+</button>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>회 청구 <span style={{ color: '#9ca3af' }}>(실제 {schedules.length}회)</span></span>
              </div>
            </div>

            {/* 수동 금액 입력 */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>수동 금액 입력 (자동 계산 덮어쓰기)</span>
                {manualAmount !== null && (
                  <button onClick={() => setManualAmount(null)} style={{ fontSize: '0.7rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>↺ 자동 계산으로</button>
                )}
              </label>
              <input type="number" min="0"
                value={manualAmount !== null ? manualAmount : ''}
                onChange={e => setManualAmount(e.target.value === '' ? null : Number(e.target.value))}
                placeholder={autoCalc ? `자동: ${fmt(autoCalc.amount)}` : '금액 직접 입력'}
                style={{ ...inputStyle, border: `1.5px solid ${manualAmount !== null ? '#f59e0b' : '#e5e7eb'}`, background: manualAmount !== null ? '#fffbeb' : 'white' }} />
            </div>
          </div>
        )}

        {/* 프로그램 미선택 시 직접 금액 입력 */}
        {!selectedProgram && (
          <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>
              수강료 (원)
              <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: '6px' }}>← 프로그램 선택 시 자동 계산</span>
            </label>
            <input style={inputStyle} type="number" value={manualAmount ?? ''} onChange={e => setManualAmount(e.target.value === '' ? null : Number(e.target.value))} placeholder="0" />
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.875rem 1rem', color: '#b91c1c', fontSize: '0.875rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* 등록 버튼 */}
        <button onClick={handleSubmit} disabled={saving}
          style={{ padding: '1rem', borderRadius: '0.75rem', border: 'none', background: saving ? '#e5e7eb' : '#16A34A', color: saving ? '#9ca3af' : 'white', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
          {saving ? '등록 중...' : `🎾 레슨 플랜 등록${schedules.length > 0 ? ` (${schedules.length}회 · ${fmt(finalAmount)})` : ''}`}
        </button>
      </div>
    </div>
  )
}