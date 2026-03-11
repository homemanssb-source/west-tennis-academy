'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Coach        { id: string; name: string }
interface Month        { id: string; year: number; month: number }
interface Program      { id: string; name: string; unit_minutes: number }
interface FamilyMember { id: string; name: string; birth_date: string | null }
interface SlotInfo     { scheduled_at: string; status: string }
interface BlockInfo    { block_date: string | null; block_start: string | null; block_end: string | null; repeat_weekly: boolean; day_of_week: number | null }
interface MyApp {
  id: string; requested_at: string; duration_minutes: number
  lesson_type: string; status: string; coach_note: string | null; admin_note: string | null
  coach: { name: string }; month: { year: number; month: number }
  applicant_name?: string
}

const DAYS_KO    = ['일','월','화','수','목','금','토']
const DAYS_LABEL = ['월','화','수','목','금','토','일']

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending_coach: { label: '코치 확인 중', color: '#854d0e', bg: '#fef9c3' },
  pending_admin: { label: '승인 대기',    color: '#1d4ed8', bg: '#eff6ff' },
  approved:      { label: '확정',         color: '#15803d', bg: '#dcfce7' },
  rejected:      { label: '거절',         color: '#b91c1c', bg: '#fee2e2' },
}

function generateDates(
  year: number, month: number, startDate: Date,
  weekdays: number[], timeStr: string,
  dayTimesMap?: Record<number, string>
): Date[] {
  const result: Date[] = []
  const lastDay = new Date(year, month, 0).getDate()
  for (let d = startDate.getDate(); d <= lastDay; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    if (!weekdays.includes(dow)) continue
    const tStr = dayTimesMap?.[dow] ?? timeStr
    if (!tStr) continue
    const [h, m] = tStr.split(':').map(Number)
    date.setHours(h, m, 0, 0)
    result.push(date)
  }
  return result
}

function fmtDate(d: Date) {
  return `${d.getMonth()+1}/${d.getDate()}(${DAYS_KO[d.getDay()]})`
}
function fmtDateTime(d: Date) {
  return `${fmtDate(d)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export default function MemberApplyPage() {
  const [tab,  setTab]  = useState<'new'|'list'>('new')
  const [step, setStep] = useState(1)

  const [coaches,  setCoaches]  = useState<Coach[]>([])
  const [months,   setMonths]   = useState<Month[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [family,   setFamily]   = useState<FamilyMember[]>([])
  const [myApps,   setMyApps]   = useState<MyApp[]>([])
  const [loading,  setLoading]  = useState(true)

  const [applicantType, setApplicantType] = useState<'self'|'family'>('self')
  const [familyId,  setFamilyId]  = useState('')
  const [coachId,   setCoachId]   = useState('')
  const [monthId,   setMonthId]   = useState('')
  const [programId, setProgramId] = useState('')
  const [duration,  setDuration]  = useState(60)

  const [weekOffset,     setWeekOffset]     = useState(0)
  const [busySlots,      setBusySlots]      = useState<SlotInfo[]>([])
  const [coachBlocks,    setCoachBlocks]    = useState<BlockInfo[]>([])
  const [selectedDate,   setSelectedDate]   = useState<Date | null>(null)
  const [selectedTime,   setSelectedTime]   = useState('')
  const [dayTimes,       setDayTimes]       = useState<Record<number, string>>({})
  const [repeatDays,     setRepeatDays]     = useState<number[]>([])
  const [generatedDates, setGeneratedDates] = useState<Date[]>([])
  const [excludedIdxs,   setExcludedIdxs]   = useState<Set<number>>(new Set())
  const [saving,         setSaving]         = useState(false)

  // 제외된 날짜를 뺀 최종 신청 목록
  const finalDates = generatedDates.filter((_, i) => !excludedIdxs.has(i))

  useEffect(() => {
    Promise.all([
      fetch('/api/coaches').then(r => r.json()),
      fetch('/api/months').then(r => r.json()),
      fetch('/api/programs').then(r => r.json()),
      fetch('/api/family').then(r => r.json()),
    ]).then(([c, m, p, f]) => {
      setCoaches(Array.isArray(c) ? c : [])
      const mList = Array.isArray(m) ? m : []
      setMonths(mList)
      if (mList.length > 0) setMonthId(mList[0].id)
      setPrograms(Array.isArray(p) ? p : [])
      setFamily(Array.isArray(f) ? f : [])
    })
    loadMyApps()
  }, [])

  const loadMyApps = async () => {
    setLoading(true)
    const res = await fetch('/api/lesson-applications?my=1')
    const d = await res.json()
    setMyApps(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  const selectedCoach   = coaches.find(c => c.id === coachId)
  const selectedMonth   = months.find(m => m.id === monthId)
  const selectedProgram = programs.find(p => p.id === programId)
  const selectedFamilyM = family.find(f => f.id === familyId)
  const pendingAppCount = myApps.filter(a => ['pending_coach','pending_admin'].includes(a.status)).length

  // 주간 달력 계산
  const today = new Date(); today.setHours(0,0,0,0)
  const baseMonday = (() => {
    const d = new Date(today)
    const dow = d.getDay()
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    return d
  })()
  const weekDates = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(baseMonday)
    d.setDate(d.getDate() + weekOffset * 7 + i)
    return d
  })
  const TIME_SLOTS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
    '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
    '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30',
    '19:00','19:30','20:00','20:30','21:00']

  useEffect(() => {
    if (!coachId || !monthId) return
    const m = months.find(x => x.id === monthId)
    if (!m) return
    const from = `${m.year}-${String(m.month).padStart(2,'0')}-01`
    const to   = `${m.year}-${String(m.month).padStart(2,'0')}-${new Date(m.year, m.month, 0).getDate()}`
    fetch(`/api/lesson-slots?coach_id=${coachId}&from=${from}&to=${to}`)
      .then(r => r.json()).then(d => setBusySlots(Array.isArray(d) ? d : []))
    fetch(`/api/coach-blocks?coach_id=${coachId}`)
      .then(r => r.json()).then(d => setCoachBlocks(Array.isArray(d) ? d : []))
  }, [coachId, monthId])

  const isBlocked = (date: Date, tStr: string) => {
    const ymd = date.toISOString().split('T')[0]
    const [th, tm] = tStr.split(':').map(Number)
    const slotStart = th * 60 + tm
    const slotEnd   = slotStart + duration
    return coachBlocks.some(b => {
      if (b.repeat_weekly) {
        if (b.day_of_week !== date.getDay()) return false
      } else {
        if (b.block_date !== ymd) return false
      }
      if (!b.block_start && !b.block_end) return true
      if (b.block_start && b.block_end) {
        const [bh, bm] = b.block_start.split(':').map(Number)
        const [eh, em] = b.block_end.split(':').map(Number)
        const bs = bh * 60 + bm, be = eh * 60 + em
        return slotStart < be && slotEnd > bs
      }
      return false
    })
  }

  const isBusy = (date: Date, tStr: string) => {
    const ymd = date.toISOString().split('T')[0]
    return busySlots.some(s => {
      const sd = new Date(s.scheduled_at)
      return sd.toISOString().split('T')[0] === ymd &&
        `${String(sd.getHours()).padStart(2,'0')}:${String(sd.getMinutes()).padStart(2,'0')}` === tStr &&
        s.status !== 'cancelled'
    })
  }

  const isPending = (date: Date, tStr: string) => {
    const ymd = date.toISOString().split('T')[0]
    const dt  = `${ymd}T${tStr}`
    return myApps.some(a =>
      ['pending_coach','pending_admin'].includes(a.status) &&
      a.requested_at?.startsWith(dt.slice(0, 16))
    )
  }

  // 요일 변경 시 날짜 재생성 + 제외목록 초기화
  useEffect(() => {
    if (!selectedDate || !selectedMonth) return
    const allDows   = Array.from(new Set([...repeatDays, selectedDate.getDay()]))
    const dtMap: Record<number, string> = { ...dayTimes }
    if (!dtMap[selectedDate.getDay()]) dtMap[selectedDate.getDay()] = selectedTime
    const dates = generateDates(selectedMonth.year, selectedMonth.month, selectedDate, allDows, selectedTime, dtMap)
    setGeneratedDates(dates)
    setExcludedIdxs(new Set())
  }, [repeatDays, dayTimes, selectedDate, selectedTime, selectedMonth])

  const toggleRepeatDay = (dow: number) => {
    if (dow === selectedDate?.getDay()) return
    setRepeatDays(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow])
  }

  const toggleExclude = (i: number) => {
    setExcludedIdxs(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!finalDates.length) return
    setSaving(true)
    // ✅ API가 기대하는 string[] 형식으로 전송
    const slots = finalDates.map(d => {
      const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const hm  = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      return `${ymd}T${hm}:00+09:00`
    })
    const res = await fetch('/api/lesson-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coach_id: coachId,
        month_id: monthId,
        slots,
        duration_minutes: duration,
        lesson_type: selectedProgram?.name ?? '개인레슨',
        family_member_id: applicantType === 'family' ? familyId : null,
      }),
    })
    const d = await res.json()
    setSaving(false)
    if (d.error) { alert(d.error); return }
    alert(`${finalDates.length}회 수업 신청 완료!\n코치 확인 후 안내드립니다.`)
    setTab('list'); setStep(1); loadMyApps()
  }

  const s = {
    input:   { width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', background: 'white', boxSizing: 'border-box' as const, outline: 'none', color: '#111827' },
    btn:     { padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer' as const, fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif' },
    btnOn:   { padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #16A34A', background: '#f0fdf4', color: '#15803d', cursor: 'pointer' as const, fontSize: '0.8rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' },
    card:    { background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' },
    label:   { fontSize: '0.75rem', fontWeight: 700 as const, color: '#6b7280', display: 'block' as const, marginBottom: '6px' },
    nextBtn: (disabled: boolean) => ({ flex: 2, padding: '0.875rem', borderRadius: '0.875rem', border: 'none', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif', cursor: disabled ? 'not-allowed' as const : 'pointer' as const, background: disabled ? '#e5e7eb' : '#16A34A', color: disabled ? '#9ca3af' : 'white' }),
    prevBtn: { flex: 1, padding: '0.875rem', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer' as const, fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 600, fontSize: '0.875rem' },
  }

  const STEP_LABELS = ['기본 정보', '날짜 선택', '반복 설정', '미리보기']

  return (
    <div className="mobile-wrap" style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>🎾 수업 신청</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['new','list'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 700, fontSize: '0.85rem', background: tab === t ? '#16A34A' : '#f3f4f6', color: tab === t ? 'white' : '#6b7280' }}>
              {t === 'new' ? '+ 새 신청' : `내 신청 (${myApps.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── 새 신청 탭 ── */}
      {tab === 'new' && (
        <div style={{ padding: '1rem 1.25rem 6rem' }}>
          {/* 스텝 인디케이터 */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem' }}>
            {STEP_LABELS.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, background: step === i+1 ? '#16A34A' : step > i+1 ? '#86efac' : '#e5e7eb', color: step === i+1 ? 'white' : step > i+1 ? '#15803d' : '#9ca3af' }}>
                    {step > i+1 ? '✓' : i+1}
                  </div>
                  <span style={{ fontSize: '0.6rem', color: step === i+1 ? '#16A34A' : '#9ca3af', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap' }}>{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div style={{ flex: 1, height: '2px', background: step > i+1 ? '#86efac' : '#e5e7eb', margin: '0 4px', marginBottom: '14px' }} />
                )}
              </div>
            ))}
          </div>

          {/* ── STEP 1: 기본 정보 ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>기본 정보</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {family.length > 0 && (
                    <div>
                      <label style={s.label}>신청자</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setApplicantType('self')} style={applicantType === 'self' ? s.btnOn : s.btn}>본인</button>
                        <button onClick={() => setApplicantType('family')} style={applicantType === 'family' ? s.btnOn : s.btn}>가족</button>
                      </div>
                      {applicantType === 'family' && (
                        <select value={familyId} onChange={e => setFamilyId(e.target.value)} style={{ ...s.input, marginTop: '0.5rem' }}>
                          <option value="">가족 선택</option>
                          {family.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                  <div>
                    <label style={s.label}>코치 선택</label>
                    <select value={coachId} onChange={e => setCoachId(e.target.value)} style={s.input}>
                      <option value="">코치를 선택해주세요</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>수업 월</label>
                    <select value={monthId} onChange={e => setMonthId(e.target.value)} style={s.input}>
                      {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
                    </select>
                  </div>
                  {programs.length > 0 && (
                    <div>
                      <label style={s.label}>프로그램</label>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {programs.map(p => (
                          <button key={p.id} onClick={() => { setProgramId(p.id); setDuration(p.unit_minutes || 60) }}
                            style={programId === p.id ? s.btnOn : s.btn}>{p.name}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label style={s.label}>수업 시간</label>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      {[30,45,60,90].map(u => (
                        <button key={u} onClick={() => setDuration(u)} style={{ ...(duration === u ? s.btnOn : s.btn), flex: 1 }}>{u}분</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setStep(2)}
                disabled={!coachId || !monthId || (applicantType === 'family' && !familyId)}
                style={s.nextBtn(!coachId || !monthId || (applicantType === 'family' && !familyId))}>
                다음 → 날짜 선택
              </button>
            </div>
          )}

          {/* ── STEP 2: 달력 ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <button onClick={() => setWeekOffset(w => w-1)} style={{ ...s.btn, padding: '0.375rem 0.75rem' }}>← 이전</button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
                    {weekDates[0].getMonth()+1}/{weekDates[0].getDate()} ~ {weekDates[5].getMonth()+1}/{weekDates[5].getDate()}
                  </span>
                  <button onClick={() => setWeekOffset(w => w+1)} style={{ ...s.btn, padding: '0.375rem 0.75rem' }}>다음 →</button>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.625rem', fontSize: '0.7rem', color: '#6b7280' }}>
                  <span style={{ color: '#15803d' }}>○ 가능</span>
                  <span style={{ color: '#b91c1c' }}>✕ 수업있음</span>
                  <span style={{ color: '#854d0e' }}>… 신청대기</span>
                  <span style={{ color: '#7c3aed' }}>휴 코치휴무</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '340px' }}>
                    <thead>
                      <tr>
                        <th style={{ fontSize: '0.65rem', color: '#9ca3af', padding: '4px', width: '36px' }}></th>
                        {weekDates.map(d => (
                          <th key={d.toISOString()} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 2px', textAlign: 'center', color: d.getDay() === 0 ? '#b91c1c' : d.getDay() === 6 ? '#1d4ed8' : '#374151' }}>
                            {DAYS_KO[d.getDay()]}<br/>
                            <span style={{ fontSize: '0.65rem', fontWeight: 400 }}>{d.getDate()}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TIME_SLOTS.map(tStr => (
                        <tr key={tStr}>
                          <td style={{ fontSize: '0.6rem', color: '#9ca3af', padding: '2px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>{tStr}</td>
                          {weekDates.map(date => {
                            const isPast  = date < today
                            const busy    = isBusy(date, tStr)
                            const blocked = isBlocked(date, tStr)
                            const pending = isPending(date, tStr)
                            const isSel   = selectedDate?.toDateString() === date.toDateString() && selectedTime === tStr
                            return (
                              <td key={date.toISOString()} style={{ padding: '1px 2px', textAlign: 'center' }}>
                                <button
                                  disabled={isPast || busy || blocked || pending}
                                  onClick={() => { setSelectedDate(new Date(date)); setSelectedTime(tStr) }}
                                  style={{ width: '100%', padding: '3px 0', borderRadius: '4px', border: isSel ? '2px solid #16A34A' : 'none', fontSize: '0.65rem', cursor: (isPast || busy || blocked || pending) ? 'not-allowed' : 'pointer', background: isSel ? '#16A34A' : busy ? '#fee2e2' : blocked ? '#f3f0ff' : pending ? '#fef9c3' : isPast ? '#f9fafb' : '#f0fdf4', color: isSel ? 'white' : busy ? '#fca5a5' : blocked ? '#7c3aed' : pending ? '#854d0e' : isPast ? '#d1d5db' : '#15803d' }}>
                                  {isSel ? '✓' : busy ? '✕' : blocked ? '휴' : pending ? '…' : '○'}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedDate && selectedTime && (
                  <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: '#f0fdf4', borderRadius: '0.625rem', fontSize: '0.85rem', color: '#15803d', fontWeight: 600 }}>
                    ✅ 첫 수업: {fmtDate(selectedDate)} {selectedTime}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(1)} style={s.prevBtn}>← 이전</button>
                <button onClick={() => setStep(3)} disabled={!selectedDate || !selectedTime} style={s.nextBtn(!selectedDate || !selectedTime)}>다음 → 반복 설정</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: 반복 설정 ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111827' }}>반복 요일 선택</h2>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.875rem' }}>
                  {fmtDate(selectedDate!)}부터 {selectedMonth?.year}년 {selectedMonth?.month}월 말일까지
                </p>

                {repeatDays.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    {repeatDays.map(dow => (
                      <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.625rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', minWidth: '32px' }}>
                          {DAYS_LABEL[dow === 0 ? 6 : dow - 1]}요일
                        </span>
                        <select value={dayTimes[dow] ?? ''} onChange={e => setDayTimes(prev => ({ ...prev, [dow]: e.target.value }))} style={{ ...s.input, flex: 1 }}>
                          <option value="">시간 선택</option>
                          {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    ))}
                    {repeatDays.some(dow => !dayTimes[dow]) && (
                      <div style={{ padding: '0.5rem 0.75rem', background: '#fef9c3', borderRadius: '0.625rem', fontSize: '0.75rem', color: '#854d0e' }}>
                        ⚠️ 모든 요일의 시간을 선택해주세요
                      </div>
                    )}
                  </div>
                )}

                {/* 요일 선택 버튼 */}
                <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem' }}>
                  {DAYS_LABEL.map((day, idx) => {
                    const dow    = idx === 6 ? 0 : idx + 1
                    const isBase = dow === selectedDate?.getDay()
                    const active = isBase || repeatDays.includes(dow)
                    return (
                      <button key={dow} onClick={() => toggleRepeatDay(dow)} disabled={isBase}
                        style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.625rem', border: `1.5px solid ${active ? '#16A34A' : '#e5e7eb'}`, background: active ? '#16A34A' : '#f3f4f6', color: active ? 'white' : '#6b7280', fontSize: '0.8rem', fontWeight: 700, cursor: isBase ? 'default' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        {day}
                      </button>
                    )
                  })}
                </div>

                {/* ── 자동 생성 일정 목록 ── */}
                {generatedDates.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>자동 생성 일정</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        <strong style={{ color: '#16A34A' }}>{finalDates.length}회</strong> 신청 예정
                        {excludedIdxs.size > 0 && <span style={{ color: '#b91c1c', marginLeft: '0.375rem' }}>({excludedIdxs.size}개 제외)</span>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '2px' }}>
                      {generatedDates.map((d, i) => {
                        const excluded = excludedIdxs.has(i)
                        const rank = generatedDates.slice(0, i).filter((_, j) => !excludedIdxs.has(j)).length + 1
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.625rem', borderRadius: '0.5rem', background: excluded ? '#fef2f2' : '#f0fdf4', border: `1px solid ${excluded ? '#fecaca' : '#bbf7d0'}`, opacity: excluded ? 0.65 : 1, transition: 'all 0.15s' }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: excluded ? '#9ca3af' : '#15803d', minWidth: '28px', textDecoration: excluded ? 'line-through' : 'none' }}>
                              {excluded ? '제외' : `${rank}회`}
                            </span>
                            <span style={{ fontSize: '0.82rem', flex: 1, color: excluded ? '#9ca3af' : '#374151', textDecoration: excluded ? 'line-through' : 'none' }}>
                              {fmtDateTime(d)}
                            </span>
                            <button onClick={() => toggleExclude(i)}
                              style={{ fontSize: '0.7rem', fontWeight: 700, border: 'none', borderRadius: '0.375rem', padding: '3px 8px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', background: excluded ? '#dcfce7' : '#fee2e2', color: excluded ? '#15803d' : '#b91c1c', flexShrink: 0 }}>
                              {excluded ? '복원' : '제외'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    {excludedIdxs.size > 0 && (
                      <button onClick={() => setExcludedIdxs(new Set())}
                        style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.75rem', color: '#6b7280', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 600 }}>
                        🔄 전체 복원
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', background: '#f9fafb', borderRadius: '0.75rem', fontSize: '0.85rem' }}>
                    반복 요일을 선택해주세요
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(2)} style={s.prevBtn}>← 이전</button>
                <button onClick={() => setStep(4)}
                  disabled={finalDates.length === 0 || repeatDays.some(dow => !dayTimes[dow])}
                  style={s.nextBtn(finalDates.length === 0 || repeatDays.some(dow => !dayTimes[dow]))}>
                  다음 → 미리보기
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: 미리보기 ── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>📋 신청 미리보기</h2>
                <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.875rem', padding: '0.875rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', fontSize: '0.8rem' }}>
                    {[
                      ['신청자',  applicantType === 'family' ? selectedFamilyM?.name ?? '' : '본인'],
                      ['코치',    `${selectedCoach?.name} 코치`],
                      ['레슨',    selectedProgram?.name ?? '개인레슨'],
                      ['시간',    `${duration}분`],
                      ['수업 월', `${selectedMonth?.year}년 ${selectedMonth?.month}월`],
                      ['총 횟수', `${finalDates.length}회`],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span style={{ color: '#6b7280' }}>{label}</span><br/>
                        <strong style={{ color: label === '총 횟수' ? '#16A34A' : '#111827', fontSize: label === '총 횟수' ? '1.1rem' : '0.875rem' }}>{val}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>전체 일정</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '220px', overflowY: 'auto' }}>
                  {finalDates.map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.375rem 0.625rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16A34A', minWidth: '28px' }}>{i+1}회</span>
                      <span style={{ fontSize: '0.8rem', color: '#374151' }}>{fmtDateTime(d)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '0.875rem', padding: '0.625rem 0.875rem', background: '#fef9c3', borderRadius: '0.625rem', fontSize: '0.75rem', color: '#854d0e' }}>
                  ※ 금액은 관리자가 별도 입력합니다
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(3)} style={s.prevBtn}>← 수정</button>
                <button onClick={handleSubmit} disabled={saving}
                  style={{ flex: 2, padding: '0.875rem', borderRadius: '0.875rem', border: 'none', fontWeight: 700, fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#e5e7eb' : '#16A34A', color: saving ? '#9ca3af' : 'white' }}>
                  {saving ? '신청 중...' : `🎾 ${finalDates.length}회 신청하기`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 내 신청 목록 ── */}
      {tab === 'list' && (
        <div style={{ padding: '1.25rem', paddingBottom: '6rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
          ) : myApps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎾</div>
              <p style={{ fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>신청 내역이 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myApps.map(app => {
                const st = STATUS[app.status] ?? STATUS.pending_coach
                return (
                  <div key={app.id} style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827', fontFamily: 'Noto Sans KR, sans-serif' }}>
                          {app.coach?.name} 코치 · {app.lesson_type}
                          {app.applicant_name && <span style={{ color: '#6b7280', fontWeight: 400 }}> ({app.applicant_name})</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                          {app.month?.year}년 {app.month?.month}월 · {app.duration_minutes}분
                        </div>
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px', background: st.bg, color: st.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {st.label}
                      </span>
                    </div>
                    {(app.coach_note || app.admin_note) && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.625rem', fontSize: '0.75rem', color: '#6b7280' }}>
                        {app.coach_note && <div>코치: {app.coach_note}</div>}
                        {app.admin_note && <div>관리자: {app.admin_note}</div>}
                      </div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                      신청일: {new Date(app.requested_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 하단 네비 */}
      <div className="bottom-nav">
        <Link href="/member" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>🏠</span><span>홈</span></Link>
        <Link href="/member/schedule" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>📅</span><span>스케줄</span></Link>
        <Link href="/member/apply" className="bottom-nav-item active" style={{ position: 'relative' }}>
          <span style={{ fontSize: '1.25rem' }}>🎾</span><span>신청</span>
          {pendingAppCount > 0 && (
            <span style={{ position: 'absolute', top: '4px', right: '8px', background: '#ef4444', color: 'white', fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: '9999px' }}>
              {pendingAppCount}
            </span>
          )}
        </Link>
        <Link href="/member/payment" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>💰</span><span>납부</span></Link>
        <Link href="/member/family" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>👨‍👩‍👧</span><span>가족</span></Link>
      </div>
    </div>
  )
}