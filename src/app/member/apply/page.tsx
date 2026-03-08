'use client'

import { useEffect, useState } from 'react'

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
const WEEKDAY_MAP: Record<string, number> = { 월:1, 화:2, 수:3, 목:4, 금:5, 토:6, 일:0 }

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending_coach: { label: '코치 확인 중', color: '#854d0e', bg: '#fef9c3' },
  pending_admin: { label: '승인 대기',   color: '#1d4ed8', bg: '#eff6ff' },
  approved:      { label: '확정',        color: '#15803d', bg: '#dcfce7' },
  rejected:      { label: '거절',        color: '#b91c1c', bg: '#fee2e2' },
}

function generateDates(year: number, month: number, startDate: Date, weekdays: number[], timeStr: string, dayTimesMap?: Record<number, string>): Date[] {
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
function fmtDtStr(dt: string) {
  const d = new Date(dt)
  return `${d.getMonth()+1}/${d.getDate()}(${DAYS_KO[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
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

  const [weekOffset,    setWeekOffset]    = useState(0)
  const [busySlots,     setBusySlots]     = useState<SlotInfo[]>([])
  const [coachBlocks,   setCoachBlocks]   = useState<BlockInfo[]>([])
  const [selectedDate,  setSelectedDate]  = useState<Date | null>(null)
  const [selectedTime,  setSelectedTime]  = useState('')
  const [dayTimes, setDayTimes] = useState<Record<number, string>>({})
  const [repeatDays,    setRepeatDays]    = useState<number[]>([])
  const [generatedDates, setGeneratedDates] = useState<Date[]>([])
  const [manualCount,   setManualCount]   = useState(0)
  const [saving, setSaving] = useState(false)

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
    const d = await fetch('/api/lesson-applications').then(r => r.json())
    setMyApps(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  const getWeekDates = () => {
    const now = new Date(); now.setHours(0,0,0,0)
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7)
    return Array.from({length: 6}, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
  }

  useEffect(() => {
    if (!coachId) { setBusySlots([]); return }
    const week = getWeekDates()
    const from = week[0].toISOString().split('T')[0]
    const to   = week[5].toISOString().split('T')[0]
    fetch(`/api/lesson-slots?coach_id=${coachId}&from=${from}&to=${to}`)
      .then(r => r.json()).then(d => setBusySlots(Array.isArray(d) ? d : []))
  }, [coachId, weekOffset])

  useEffect(() => {
    if (!selectedDate || repeatDays.length === 0) return
    const hasAllTimes = repeatDays.every(dow => dayTimes[dow])
    if (!hasAllTimes) return
    const m = months.find(m => m.id === monthId)
    if (!m) return
    const dates = generateDates(m.year, m.month, selectedDate, repeatDays, selectedTime, dayTimes)
    setGeneratedDates(dates)
    setManualCount(dates.length)
  }, [selectedDate, selectedTime, dayTimes, repeatDays, monthId])

  const checkSlot = (date: Date, time: string, statusList: string[]) => {
    const [h, min] = time.split(':').map(Number)
    const dt = new Date(date); dt.setHours(h, min, 0, 0)
    return busySlots.some(s => {
      const sd = new Date(s.scheduled_at)
      return sd.getFullYear() === dt.getFullYear() && sd.getMonth() === dt.getMonth() &&
             sd.getDate() === dt.getDate() && sd.getHours() === dt.getHours() &&
             sd.getMinutes() === dt.getMinutes() && statusList.includes(s.status)
    })
  }

  const checkBlock = (date: Date, time: string) => {
    const [h, min] = time.split(':').map(Number)
    const dow = date.getDay()
    return coachBlocks.some(b => {
      if (b.repeat_weekly && b.day_of_week === dow) {
        if (!b.block_start && !b.block_end) return true
        const bStart = b.block_start ? parseInt(b.block_start.replace(':','')) : 0
        const bEnd   = b.block_end   ? parseInt(b.block_end.replace(':',''))   : 2359
        const t      = h * 100 + min
        return t >= bStart && t < bEnd
      }
      if (!b.repeat_weekly && b.block_date) {
        const bd = b.block_date.split('T')[0]
        const dd = date.toISOString().split('T')[0]
        if (bd !== dd) return false
        if (!b.block_start && !b.block_end) return true
        const bStart = b.block_start ? parseInt(b.block_start.replace(':','')) : 0
        const bEnd   = b.block_end   ? parseInt(b.block_end.replace(':',''))   : 2359
        const t      = h * 100 + min
        return t >= bStart && t < bEnd
      }
      return false
    })
  }

  const weekDates   = getWeekDates()
  const slotInterval = duration <= 30 ? 30 : 60
  const slotCount    = duration <= 30 ? 28 : 14
  const timeSlots    = Array.from({length: slotCount}, (_, i) => { const totalMin = 7*60 + i*slotInterval; return String(Math.floor(totalMin/60)).padStart(2,'0') + ':' + String(totalMin%60).padStart(2,'0') })
  const finalDates  = generatedDates.slice(0, manualCount)
  const selectedProgram = programs.find(p => p.id === programId)
  const selectedMonth   = months.find(m => m.id === monthId)
  const selectedCoach   = coaches.find(c => c.id === coachId)
  const selectedFamilyM = family.find(f => f.id === familyId)

  const toggleRepeatDay = (dow: number) =>
    setRepeatDays(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow].sort())

  const handleSubmit = async () => {
    if (!coachId || !monthId || !selectedDate || !selectedTime || finalDates.length === 0) {
      alert('모든 항목을 입력해주세요'); return
    }
    setSaving(true)
    const slots = finalDates.map(d =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${selectedTime}:00+09:00`
    )
    const res = await fetch('/api/lesson-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coach_id: coachId, month_id: monthId, slots,
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

  // 공통 스타일
  const s = {
    input: { width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', background: 'white', boxSizing: 'border-box' as const, outline: 'none', color: '#111827' },
    btn:   { padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer' as const, fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif' },
    btnOn: { padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #16A34A', background: '#f0fdf4', color: '#15803d', cursor: 'pointer' as const, fontSize: '0.8rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' },
    card:  { background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' },
    label: { fontSize: '0.75rem', fontWeight: 700 as const, color: '#6b7280', display: 'block' as const, marginBottom: '6px' },
    nextBtn: (disabled: boolean) => ({
      flex: 2, padding: '0.875rem', borderRadius: '0.875rem', border: 'none', fontWeight: 700,
      fontFamily: 'Noto Sans KR, sans-serif', cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
      background: disabled ? '#e5e7eb' : '#16A34A', color: disabled ? '#9ca3af' : 'white',
    }),
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
              style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer',
                fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 700, fontSize: '0.85rem',
                background: tab === t ? '#16A34A' : '#f3f4f6', color: tab === t ? 'white' : '#6b7280' }}>
              {t === 'new' ? '+ 새 신청' : `내 신청 (${myApps.length})`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'new' && (
        <div style={{ padding: '1.25rem', paddingBottom: '6rem' }}>
          {/* 스텝 인디케이터 */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem' }}>
            {[1,2,3,4].map((n, i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, background: step >= n ? '#16A34A' : '#e5e7eb', color: step >= n ? 'white' : '#9ca3af' }}>{n}</div>
                {i < 3 && <div style={{ flex: 1, height: '2px', background: step > n ? '#16A34A' : '#e5e7eb', margin: '0 4px' }} />}
              </div>
            ))}
            <span style={{ fontSize: '0.7rem', color: '#6b7280', marginLeft: '8px', flexShrink: 0 }}>{STEP_LABELS[step-1]}</span>
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>기본 정보</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

                  {/* 신청자 */}
                  <div>
                    <label style={s.label}>신청자</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <button onClick={() => setApplicantType('self')}   style={{ ...(applicantType === 'self'   ? s.btnOn : s.btn), flex: 1 }}>👤 본인</button>
                      <button onClick={() => setApplicantType('family')} style={{ ...(applicantType === 'family' ? s.btnOn : s.btn), flex: 1 }}>👨‍👩‍👧 가족</button>
                    </div>
                    {applicantType === 'family' && (
                      family.length === 0
                        ? <div style={{ fontSize: '0.8rem', color: '#b91c1c', padding: '0.5rem', background: '#fef2f2', borderRadius: '0.5rem' }}>등록된 가족이 없습니다. 가족 메뉴에서 먼저 등록해주세요.</div>
                        : <select style={s.input} value={familyId} onChange={e => setFamilyId(e.target.value)}>
                            <option value="">가족 선택</option>
                            {family.map(f => <option key={f.id} value={f.id}>{f.name}{f.birth_date ? ` (${f.birth_date.slice(0,4)}년생)` : ''}</option>)}
                          </select>
                    )}
                  </div>

                  {/* 코치 */}
                  <div>
                    <label style={s.label}>코치 선택</label>
                    <select style={s.input} value={coachId} onChange={e => setCoachId(e.target.value)}>
                      <option value="">코치를 선택하세요</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
                    </select>
                  </div>

                  {/* 수업 월 */}
                  <div>
                    <label style={s.label}>수업 월</label>
                    <select style={s.input} value={monthId} onChange={e => setMonthId(e.target.value)}>
                      {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
                    </select>
                  </div>

                  {/* 레슨 유형 */}
                  <div>
                    <label style={s.label}>레슨 유형</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                      {programs.map(p => (
                        <button key={p.id} onClick={() => { setProgramId(p.id); setDuration(p.unit_minutes || 60) }}
                          style={programId === p.id ? s.btnOn : s.btn}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 수업 시간 */}
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
              <button onClick={() => setStep(2)} disabled={!coachId || !monthId || (applicantType === 'family' && !familyId)} style={s.nextBtn(!coachId || !monthId || (applicantType === 'family' && !familyId))}>
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
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '340px' }}>
                    <thead>
                      <tr>
                        <th style={{ fontSize: '0.65rem', color: '#9ca3af', padding: '4px', width: '36px' }}></th>
                        {weekDates.map(d => (
                          <th key={d.toISOString()} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 2px', textAlign: 'center', color: d.getDay() === 0 ? '#b91c1c' : d.getDay() === 6 ? '#1d4ed8' : '#374151' }}>
                            {DAYS_KO[d.getDay()]}<br/><span style={{ fontSize: '0.65rem', fontWeight: 400 }}>{d.getDate()}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeSlots.map(time => (
                        <tr key={time}>
                          <td style={{ fontSize: '0.6rem', color: '#9ca3af', padding: '2px 4px', textAlign: 'right' }}>{time}</td>
                          {weekDates.map(d => {
                            const busy    = checkSlot(d, time, ['scheduled','completed'])
                            const pending = checkSlot(d, time, ['pending_coach','pending_admin'])
                            const blocked = checkBlock(d, time)
                            const isSel   = selectedDate?.toDateString() === d.toDateString() && selectedTime === time
                            const isPast  = d < new Date(new Date().setHours(0,0,0,0))
                            return (
                              <td key={d.toISOString()} style={{ padding: '2px', textAlign: 'center' }}>
                                <button disabled={busy || isPast || blocked} onClick={() => {
                                    const dow = d.getDay()
                                    setSelectedDate(new Date(d))
                                    setSelectedTime(time)
                                    setDayTimes(prev => ({ ...prev, [dow]: time }))
                                    if (!repeatDays.includes(dow)) setRepeatDays([dow])
                                  }}
                                  style={{ width: '100%', padding: '5px 2px', borderRadius: '4px', border: 'none',
                                    fontSize: '0.65rem', cursor: busy || isPast || blocked ? 'not-allowed' : 'pointer',
                                    background: isSel ? '#16A34A' : busy ? '#fee2e2' : blocked ? '#f3f0ff' : pending ? '#fef9c3' : isPast ? '#f9fafb' : '#f0fdf4',
                                    color: isSel ? 'white' : busy ? '#fca5a5' : blocked ? '#7c3aed' : pending ? '#854d0e' : isPast ? '#d1d5db' : '#15803d',
                                  }}>
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

          {/* ── STEP 3: 반복 ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111827' }}>반복 요일 선택</h2>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.875rem' }}>
                  {fmtDate(selectedDate!)}부터 {selectedMonth?.year}년 {selectedMonth?.month}월 말일까지
                </p>
                {/* 요일별 시간 선택 */}
                {repeatDays.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    {repeatDays.map(dow => (
                      <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.625rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', minWidth: '32px' }}>
                          {DAYS_LABEL[dow === 0 ? 6 : dow - 1]}요일
                        </span>
                        <select
                          value={dayTimes[dow] ?? ''}
                          onChange={e => {
                            const t = e.target.value
                            setDayTimes(prev => ({ ...prev, [dow]: t }))
                            if (dow === selectedDate?.getDay()) setSelectedTime(t)
                          }}
                          style={{ flex: 1, padding: '0.375rem 0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.8rem', background: 'white', color: '#111827', outline: 'none' }}
                        >
                          <option value=''>시간 선택</option>
                          {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {dayTimes[dow] && <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 700 }}>✓</span>}
                      </div>
                    ))}
                    {!repeatDays.every(d => dayTimes[d]) && (
                      <div style={{ fontSize: '0.75rem', color: '#854d0e', padding: '0.375rem 0.75rem', background: '#fef9c3', borderRadius: '0.5rem' }}>
                        ⚠ 모든 요일의 시간을 선택해주세요
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem' }}>
                  {DAYS_LABEL.map(day => {
                    const dow    = WEEKDAY_MAP[day]
                    const active = repeatDays.includes(dow)
                    return (
                      <button key={day} onClick={() => toggleRepeatDay(dow)}
                        style={{ flex: 1, padding: '0.625rem 0', borderRadius: '0.625rem', border: 'none',
                          fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                          background: active ? '#16A34A' : '#f3f4f6', color: active ? 'white' : '#6b7280' }}>
                        {day}
                      </button>
                    )
                  })}
                </div>

                {generatedDates.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>자동 생성 일정</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button onClick={() => setManualCount(c => Math.max(1, c-1))} style={{ ...s.btn, padding: '2px 12px', fontSize: '1.1rem' }}>−</button>
                        <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#16A34A', minWidth: '28px', textAlign: 'center' }}>{manualCount}</span>
                        <button onClick={() => setManualCount(c => Math.min(generatedDates.length, c+1))} style={{ ...s.btn, padding: '2px 12px', fontSize: '1.1rem' }}>+</button>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>회</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {generatedDates.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.625rem', borderRadius: '0.5rem', background: i < manualCount ? '#f0fdf4' : '#f9fafb', opacity: i < manualCount ? 1 : 0.35 }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', minWidth: '28px' }}>{i+1}회</span>
                          <span style={{ fontSize: '0.8rem', color: '#374151' }}>{fmtDateTime(d)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                      총 {generatedDates.length}개 중 <strong style={{ color: '#16A34A' }}>{manualCount}회</strong> 신청 예정
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', background: '#f9fafb', borderRadius: '0.75rem', fontSize: '0.85rem' }}>
                    반복 요일을 선택해주세요
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(2)} style={s.prevBtn}>← 이전</button>
                <button onClick={() => setStep(4)} disabled={finalDates.length === 0} style={s.nextBtn(finalDates.length === 0)}>다음 → 미리보기</button>
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
                      ['신청자', applicantType === 'family' ? selectedFamilyM?.name ?? '' : '본인'],
                      ['코치',   `${selectedCoach?.name} 코치`],
                      ['레슨',   selectedProgram?.name ?? '개인레슨'],
                      ['시간',   `${duration}분`],
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
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎾</div>
              <p>신청 내역이 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {myApps.map(a => {
                const st = STATUS[a.status] ?? STATUS.pending_coach
                return (
                  <div key={a.id} style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#111827' }}>{a.coach?.name} 코치</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: st.bg, color: st.color }}>{st.label}</span>
                      {a.applicant_name && <span style={{ fontSize: '0.7rem', color: '#7e22ce', background: '#fdf4ff', padding: '2px 6px', borderRadius: '9999px' }}>{a.applicant_name}</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{fmtDtStr(a.requested_at)} · {a.duration_minutes}분 · {a.lesson_type}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{a.month?.year}년 {a.month?.month}월</div>
                    {a.coach_note  && <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#6b7280', background: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>코치: {a.coach_note}</div>}
                    {a.admin_note  && <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#6b7280', background: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>관리: {a.admin_note}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}





