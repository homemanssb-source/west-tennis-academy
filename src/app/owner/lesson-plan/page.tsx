'use client'
// src/app/owner/lesson-plan/page.tsx
// ✅ fix: generateSchedules/saveEdit toISOString UTC 날짜 버그 수정
// ✅ fix: fmtDt KST 기준으로 수정
// ✅ fix: 등록 버튼 안내 문구 추가

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Coach   { id: string; name: string }
interface Month   { id: string; year: number; month: number }
interface Member  { id: string; name: string; phone: string; discount_amount: number; discount_memo: string | null }
interface Program {
  id: string; name: string; unit_minutes: number
  default_amount: number; per_session_price: number
  coach_id: string | null; is_active?: boolean
}
interface Schedule { datetime: string; duration: number }
interface WtaConfig { session_threshold: number; sat_surcharge: number; sun_surcharge: number }

const DAYS = ['일','월','화','수','목','금','토']
const fmt  = (n: number) => `₩${Math.max(0, n || 0).toLocaleString()}`

// ✅ KST 기준 날짜 포맷 헬퍼
function toKSTDateParts(dt: Date) {
  const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000)
  const y  = kst.getUTCFullYear()
  const m  = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d  = String(kst.getUTCDate()).padStart(2, '0')
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mm = String(kst.getUTCMinutes()).padStart(2, '0')
  const dow = kst.getUTCDay()
  return { y, m, d, hh, mm, dow }
}

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

export default function LessonPlanCreatePage() {
  const router = useRouter()

  const [coaches,     setCoaches]     = useState<Coach[]>([])
  const [months,      setMonths]      = useState<Month[]>([])
  const [members,     setMembers]     = useState<Member[]>([])
  const [allPrograms, setAllPrograms] = useState<Program[]>([])
  const [programs,    setPrograms]    = useState<Program[]>([])
  const [config,      setConfig]      = useState<WtaConfig>({ session_threshold: 8, sat_surcharge: 0, sun_surcharge: 0 })
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  const [memberId,       setMemberId]       = useState('')
  const [memberSearch,   setMemberSearch]   = useState('')
  const [showMemberDrop, setShowMemberDrop] = useState(false)
  const memberRef = useRef<HTMLDivElement>(null)

  const [coachId,     setCoachId]     = useState('')
  const [monthId,     setMonthId]     = useState('')
  const [programId,   setProgramId]   = useState('')
  const [lessonType,  setLessonType]  = useState('')
  const [unitMinutes, setUnitMinutes] = useState(60)
  const [payment,     setPayment]     = useState<'unpaid'|'paid'>('unpaid')

  // 일정 자동생성
  const [startDate,    setStartDate]    = useState('')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [time,         setTime]         = useState('09:00')
  const [count,        setCount]        = useState(8)
  const [schedules,    setSchedules]    = useState<Schedule[]>([])
  const [editIdx,      setEditIdx]      = useState<number|null>(null)
  const [editTime,     setEditTime]     = useState('')

  // ✅ 레슨비 계산 상태
  const [billingCount,   setBillingCount]   = useState<number | null>(null)
  const [manualAmount,   setManualAmount]   = useState<number | null>(null)
  const [memberDiscount, setMemberDiscount] = useState(0)
  const [discountMemo,   setDiscountMemo]   = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/coaches').then(r => r.json()),
      fetch('/api/months').then(r => r.json()),
      fetch('/api/members').then(r => r.json()),
      fetch('/api/programs').then(r => r.json()),
      fetch('/api/config').then(r => r.json()),
    ]).then(([c, m, mem, p, cfg]) => {
      setCoaches(Array.isArray(c) ? c : [])
      const mList = Array.isArray(m) ? m : []
      setMonths(mList)
      if (mList.length > 0) setMonthId(mList[0].id)
      setMembers(Array.isArray(mem) ? mem : [])
      const pList = Array.isArray(p) ? p : []
      setAllPrograms(pList)
      setPrograms(pList.filter((x: Program) => x.coach_id === null))
      if (cfg && !cfg.error) setConfig(cfg)
    })
  }, [])

  useEffect(() => {
    if (!coachId) {
      setPrograms(allPrograms.filter(x => x.coach_id === null))
      setProgramId(''); setLessonType('')
      return
    }
    fetch(`/api/programs?coach_id=${coachId}`).then(r => r.json()).then(d => setPrograms(Array.isArray(d) ? d : []))
    setProgramId(''); setLessonType('')
    setManualAmount(null)
  }, [coachId])

  // 회원 선택 시 할인 정보 반영
  useEffect(() => {
    const m = members.find(x => x.id === memberId)
    setMemberDiscount(m?.discount_amount ?? 0)
    setDiscountMemo(m?.discount_memo ?? null)
    setManualAmount(null)
  }, [memberId, members])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) setShowMemberDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredMembers = memberSearch
    ? members.filter(m => m.name.includes(memberSearch) || m.phone.includes(memberSearch))
    : members

  const selectedProgram = programs.find(p => p.id === programId) ?? null

  const handleProgramSelect = (p: Program) => {
    setProgramId(p.id)
    setLessonType(p.name)
    setUnitMinutes(p.unit_minutes || 60)
    setManualAmount(null)
  }

  const toggleDay = (d: number) =>
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  // ✅ fix: toISOString().split('T')[0] → KST 기준 날짜 문자열로 교체
  const generateSchedules = () => {
    if (!startDate || !selectedDays.length) return
    const result: Schedule[] = []
    // "YYYY-MM-DD" 를 로컬 자정으로 파싱 (UTC 변환 방지)
    const [y, mo, d] = startDate.split('-').map(Number)
    const cur = new Date(y, mo - 1, d)
    let cnt = 0
    while (cnt < count) {
      if (selectedDays.includes(cur.getDay())) {
        const yy  = cur.getFullYear()
        const mm  = String(cur.getMonth() + 1).padStart(2, '0')
        const dd  = String(cur.getDate()).padStart(2, '0')
        result.push({ datetime: `${yy}-${mm}-${dd}T${time}:00+09:00`, duration: unitMinutes })
        cnt++
      }
      cur.setDate(cur.getDate() + 1)
    }
    setSchedules(result)
    setBillingCount(null)
    setManualAmount(null)
  }

  const removeSlot = (i: number) => {
    setSchedules(prev => prev.filter((_, idx) => idx !== i))
    setManualAmount(null)
  }

  const startEdit = (i: number) => {
    // ✅ fix: KST 기준으로 시간 표시
    const { hh, mm } = toKSTDateParts(new Date(schedules[i].datetime))
    setEditTime(`${hh}:${mm}`)
    setEditIdx(i)
  }

  const saveEdit = (i: number) => {
    setSchedules(prev => prev.map((s, idx) => {
      if (idx !== i) return s
      // ✅ fix: 기존 datetime에서 KST 날짜 추출 후 새 시간 조합
      const { y, m, d } = toKSTDateParts(new Date(s.datetime))
      return { ...s, datetime: `${y}-${m}-${d}T${editTime}:00+09:00` }
    }))
    setEditIdx(null)
  }

  // ✅ fix: KST 기준 날짜/시간 표시
  const fmtDt = (dt: string) => {
    const { y, m, d, hh, mm, dow } = toKSTDateParts(new Date(dt))
    return `${Number(m)}/${Number(d)}(${DAYS[dow]}) ${hh}:${mm}`
  }

  // ── 레슨비 자동 계산 ──────────────────────────────────────────────
  const effectiveBillingCount = billingCount !== null ? billingCount : schedules.length
  // ✅ fix: KST 기준 요일로 토/일 집계
  const satCount = schedules.filter(s => toKSTDateParts(new Date(s.datetime)).dow === 6).length
  const sunCount = schedules.filter(s => toKSTDateParts(new Date(s.datetime)).dow === 0).length

  const autoCalc = selectedProgram && schedules.length > 0
    ? calcAmount({
        config,
        default_amount:    selectedProgram.default_amount,
        per_session_price: selectedProgram.per_session_price,
        billing_count:     effectiveBillingCount,
        sat_count:         satCount,
        sun_count:         sunCount,
        discount_amount:   memberDiscount,
      })
    : null

  const finalAmount = manualAmount !== null ? manualAmount : (autoCalc?.amount ?? 0)

  const handleSubmit = async () => {
    setError('')
    if (!memberId || !coachId || !monthId) { setError('회원, 코치, 수업월을 선택해주세요'); return }
    if (!schedules.length) { setError('수업 일정을 생성해주세요'); return }
    setSaving(true)
    const res = await fetch('/api/lesson-plans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: memberId, coach_id: coachId, month_id: monthId,
        lesson_type: lessonType || '개인레슨', unit_minutes: unitMinutes,
        schedules, amount: finalAmount, payment_status: payment,
        program_id: programId || undefined,
        billing_count: effectiveBillingCount,
      }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error || '등록 실패'); return }
    router.replace('/owner/planlist')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
    border: '1.5px solid #e5e7eb', fontSize: '0.875rem',
    fontFamily: 'Noto Sans KR, sans-serif', outline: 'none',
    boxSizing: 'border-box', background: 'white',
  }
  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px',
  }

  const selectedCoachName = coaches.find(c => c.id === coachId)?.name
  const isSubmitDisabled = saving || !memberId || !coachId || !monthId || !schedules.length

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

        {/* 기본 정보 */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>기본 정보</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            {/* 회원 검색 */}
            <div>
              <label style={labelStyle}>회원</label>
              <div ref={memberRef} style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, border: memberId ? '1.5px solid #16A34A' : '1.5px solid #e5e7eb' }}
                  placeholder="이름 또는 전화번호 검색"
                  value={memberSearch}
                  onChange={e => { setMemberSearch(e.target.value); setMemberId(''); setShowMemberDrop(true) }}
                  onFocus={() => setShowMemberDrop(true)}
                />
                {memberId && <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#16A34A', fontSize: '1rem' }}>✓</span>}
                {showMemberDrop && filteredMembers.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', zIndex: 50, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {filteredMembers.map(m => (
                      <div key={m.id} onClick={() => { setMemberId(m.id); setMemberSearch(m.name); setShowMemberDrop(false) }}
                        style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', fontSize: '0.875rem', borderBottom: '1px solid #f3f4f6', fontFamily: 'Noto Sans KR, sans-serif' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        <span style={{ color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.8rem' }}>{m.phone}</span>
                        {(m.discount_amount ?? 0) > 0 && <span style={{ color: '#7e22ce', marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>할인 {m.discount_amount.toLocaleString()}원</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 코치 */}
            <div>
              <label style={labelStyle}>코치</label>
              <select style={inputStyle} value={coachId} onChange={e => setCoachId(e.target.value)}>
                <option value="">코치 선택</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* 수업월 */}
            <div>
              <label style={labelStyle}>수업월</label>
              <select style={inputStyle} value={monthId} onChange={e => setMonthId(e.target.value)}>
                <option value="">월 선택</option>
                {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 수업 설정 */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업 설정</h2>
          <div>
            <label style={labelStyle}>
              프로그램
              {coachId && selectedCoachName && <span style={{ fontWeight: 400, color: '#3b82f6', marginLeft: '6px' }}>— {selectedCoachName} 코치 기준</span>}
            </label>
            {!coachId ? (
              <div style={{ padding: '0.75rem 1rem', background: '#f9fafb', borderRadius: '0.625rem', border: '1.5px dashed #e5e7eb', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
                👆 먼저 코치를 선택하면 해당 코치의 수업 프로그램이 표시됩니다
              </div>
            ) : programs.length === 0 ? (
              <div style={{ padding: '0.75rem 1rem', background: '#fef9c3', borderRadius: '0.625rem', border: '1.5px solid #fde68a', fontSize: '0.8rem', color: '#854d0e' }}>
                ⚠️ 등록된 프로그램이 없습니다. <Link href="/owner/programs" style={{ color: '#1d4ed8', fontWeight: 700 }}>프로그램 관리</Link>에서 추가해주세요.
              </div>
            ) : (
              <>
                <select style={inputStyle} value={programId}
                  onChange={e => {
                    const p = programs.find(x => x.id === e.target.value)
                    if (p) handleProgramSelect(p)
                    else { setProgramId(''); setLessonType(''); setUnitMinutes(60) }
                  }}>
                  <option value="">프로그램을 선택하세요</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.coach_id ? '★ ' : ''}{p.name} ({p.unit_minutes}분)
                      {p.default_amount > 0 ? ` · 월정액 ${p.default_amount.toLocaleString()}원` : ''}
                    </option>
                  ))}
                </select>
                {selectedProgram && (
                  <div style={{ marginTop: '0.5rem', padding: '0.625rem 0.875rem', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.625rem', fontSize: '0.78rem', color: '#15803d', fontWeight: 600, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <span>✅ <strong>{selectedProgram.name}</strong> · {selectedProgram.unit_minutes}분</span>
                    {selectedProgram.default_amount > 0 && <span>월정액 {selectedProgram.default_amount.toLocaleString()}원</span>}
                    {selectedProgram.per_session_price > 0 && <span style={{ color: '#1d4ed8' }}>회당 {selectedProgram.per_session_price.toLocaleString()}원</span>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 일정 자동 생성 */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업 일정 생성</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={labelStyle}>시작 날짜</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>수업 요일</label>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.625rem', border: `1.5px solid ${selectedDays.includes(i) ? (i===0?'#dc2626':i===6?'#d97706':'#16A34A') : '#e5e7eb'}`, background: selectedDays.includes(i) ? (i===0?'#fef2f2':i===6?'#fffbeb':'#f0fdf4') : 'white', color: selectedDays.includes(i) ? (i===0?'#dc2626':i===6?'#d97706':'#16A34A') : '#9ca3af', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>수업 시간</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>총 수업 횟수</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={() => setCount(c => Math.max(1, c-1))} style={{ width: '36px', height: '36px', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb', background: 'white', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>−</button>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#16A34A', minWidth: '32px', textAlign: 'center' }}>{count}</span>
                  <button onClick={() => setCount(c => c+1)} style={{ width: '36px', height: '36px', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb', background: 'white', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>+</button>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>회</span>
                </div>
              </div>
            </div>
            <button onClick={generateSchedules} disabled={!startDate || !selectedDays.length}
              style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'Noto Sans KR, sans-serif', cursor: (!startDate || !selectedDays.length) ? 'not-allowed' : 'pointer', background: (!startDate || !selectedDays.length) ? '#e5e7eb' : '#1d4ed8', color: (!startDate || !selectedDays.length) ? '#9ca3af' : 'white' }}>
              📅 일정 자동 생성
            </button>
            {schedules.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
                  생성된 일정 <span style={{ color: '#16A34A' }}>({schedules.length}회)</span>
                  <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: '0.5rem' }}>✏️ 시간수정 · 🗑️ 삭제 가능</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '240px', overflowY: 'auto' }}>
                  {schedules.map((s, i) => {
                    const dow = toKSTDateParts(new Date(s.datetime)).dow
                    const isWeekend = dow === 0 || dow === 6
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: isWeekend ? '#fffbeb' : '#f9fafb', borderRadius: '0.5rem', border: `1px solid ${isWeekend ? '#fde68a' : '#f3f4f6'}` }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isWeekend ? '#d97706' : '#16A34A', minWidth: '28px' }}>{i+1}회</span>
                        {editIdx === i ? (
                          <>
                            <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                              style={{ flex: 1, fontSize: '0.85rem', border: '1.5px solid #3b82f6', borderRadius: '0.375rem', padding: '2px 6px', fontFamily: 'Noto Sans KR, sans-serif' }} />
                            <button onClick={() => saveEdit(i)} style={{ fontSize: '0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.375rem', padding: '4px 10px', cursor: 'pointer', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif' }}>저장</button>
                            <button onClick={() => setEditIdx(null)} style={{ fontSize: '0.75rem', background: '#e5e7eb', color: '#6b7280', border: 'none', borderRadius: '0.375rem', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '0.85rem', color: '#374151', flex: 1 }}>{fmtDt(s.datetime)}</span>
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{s.duration}분</span>
                            {isWeekend && <span style={{ fontSize: '0.65rem', color: '#d97706', fontWeight: 700 }}>주말</span>}
                            <button onClick={() => startEdit(i)} style={{ fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px', color: '#6b7280' }}>✏️</button>
                            <button onClick={() => { if (confirm(`${fmtDt(s.datetime)} 삭제할까요?`)) removeSlot(i) }} style={{ fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px', color: '#ef4444' }}>🗑️</button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ✅ 레슨비 미리보기 */}
        {selectedProgram && schedules.length > 0 && (
          <div style={{ background: 'white', border: '1.5px solid #dbeafe', borderRadius: '1rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1rem' }}>💰</span>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#1e40af' }}>레슨비 미리보기</span>
              {manualAmount !== null && <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', borderRadius: '999px', padding: '2px 8px', fontWeight: 700 }}>수동 입력</span>}
            </div>
            {autoCalc && (
              <div style={{ marginBottom: '0.875rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ color: '#4b5563' }}>
                    기본금액
                    <span style={{ color: '#9ca3af', fontSize: '0.72rem', marginLeft: '4px' }}>
                      ({effectiveBillingCount >= config.session_threshold
                        ? effectiveBillingCount === config.session_threshold ? '월정액' : `월정액 + ${effectiveBillingCount - config.session_threshold}회 초과`
                        : `${selectedProgram.per_session_price.toLocaleString()}원 × ${effectiveBillingCount}회`})
                    </span>
                  </span>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700 }}>{fmt(autoCalc.base_amount)}</span>
                </div>
                {autoCalc.sat_extra > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#4b5563' }}>토요일 추가금 <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>({satCount}회 → 고정)</span></span>
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#d97706' }}>+{fmt(autoCalc.sat_extra)}</span>
                  </div>
                )}
                {autoCalc.sun_extra > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#4b5563' }}>일요일 추가금 <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>({sunCount}회 → 고정)</span></span>
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#d97706' }}>+{fmt(autoCalc.sun_extra)}</span>
                  </div>
                )}
                {memberDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#4b5563' }}>회원 할인 {discountMemo && <span style={{ color: '#9ca3af', fontSize: '0.72rem' }}>({discountMemo})</span>}</span>
                    <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#7e22ce' }}>−{fmt(memberDiscount)}</span>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: manualAmount !== null ? '#fffbeb' : '#eff6ff', borderRadius: '0.75rem', border: `1.5px solid ${manualAmount !== null ? '#fde68a' : '#bfdbfe'}`, marginBottom: '0.875rem' }}>
              <span style={{ fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>최종 레슨비</span>
              <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#1e40af' }}>{fmt(finalAmount)}</span>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>청구 횟수 조정 <span style={{ fontWeight: 400, color: '#9ca3af' }}>(서비스 제외 시 줄이기)</span></span>
                {billingCount !== null && (
                  <button onClick={() => { setBillingCount(null); setManualAmount(null) }} style={{ fontSize: '0.7rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>↺ 자동 ({schedules.length}회)</button>
                )}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => { setBillingCount(Math.max(0, effectiveBillingCount - 1)); setManualAmount(null) }} style={{ width: '36px', height: '36px', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb', background: 'white', fontWeight: 700, cursor: 'pointer' }}>−</button>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: effectiveBillingCount !== schedules.length ? '#7e22ce' : '#111827', minWidth: '40px', textAlign: 'center' }}>{effectiveBillingCount}</span>
                <button onClick={() => { setBillingCount(effectiveBillingCount + 1); setManualAmount(null) }} style={{ width: '36px', height: '36px', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb', background: 'white', fontWeight: 700, cursor: 'pointer' }}>+</button>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>회 청구 <span style={{ color: '#9ca3af' }}>(실제 {schedules.length}회)</span></span>
              </div>
            </div>
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

        {/* 결제 정보 */}
        <div style={cardStyle}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>결제 정보</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {!selectedProgram && (
              <div>
                <label style={labelStyle}>수업료 (원) <span style={{ fontWeight: 400, color: '#9ca3af' }}>← 프로그램 선택 시 자동 계산</span></label>
                <input type="number" value={finalAmount || ''} onChange={e => setManualAmount(Number(e.target.value))} placeholder="0" style={inputStyle} />
              </div>
            )}
            {selectedProgram && schedules.length > 0 && (
              <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', borderRadius: '0.75rem', border: '1.5px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803d' }}>등록될 레슨비</span>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.3rem', fontWeight: 700, color: '#15803d' }}>{fmt(finalAmount)}</span>
              </div>
            )}
            <div>
              <label style={labelStyle}>결제 상태</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['unpaid', 'paid'] as const).map(s => (
                  <button key={s} onClick={() => setPayment(s)}
                    style={{ flex: 1, padding: '0.625rem', borderRadius: '0.625rem', border: `1.5px solid ${payment === s ? (s==='paid'?'#16A34A':'#dc2626') : '#e5e7eb'}`, background: payment === s ? (s==='paid'?'#f0fdf4':'#fef2f2') : 'white', color: payment === s ? (s==='paid'?'#16A34A':'#dc2626') : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {s === 'paid' ? '✅ 납부' : '❌ 미납'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', fontSize: '0.875rem', color: '#b91c1c', fontFamily: 'Noto Sans KR, sans-serif' }}>
            ⚠️ {error}
          </div>
        )}

        {/* ✅ fix: 등록 버튼 비활성 시 안내 문구 */}
        {memberId && coachId && monthId && !schedules.length && (
          <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '0.75rem', fontSize: '0.875rem', color: '#92400e', fontFamily: 'Noto Sans KR, sans-serif', textAlign: 'center' }}>
            ⚠️ 날짜·요일·시간 선택 후 <strong>📅 일정 자동 생성</strong> 버튼을 눌러주세요
          </div>
        )}

        <button onClick={handleSubmit} disabled={isSubmitDisabled}
          style={{ padding: '1rem', borderRadius: '0.875rem', border: 'none', fontWeight: 700, fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif', cursor: isSubmitDisabled ? 'not-allowed' : 'pointer', background: isSubmitDisabled ? '#e5e7eb' : '#16A34A', color: isSubmitDisabled ? '#9ca3af' : 'white' }}>
          {saving ? '등록 중...' : `🎾 스케줄 등록 (${schedules.length}회 · ${fmt(finalAmount)})`}
        </button>
      </div>
    </div>
  )
}