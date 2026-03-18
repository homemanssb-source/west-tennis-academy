'use client'
// src/app/member/apply/page.tsx
// ✅ 그룹수업: 고정 스케줄 자동 표시 → 1클릭 신청
// ✅ 개인수업: 기존 달력 선택 방식 유지

import { useEffect, useState } from 'react'
import MemberBottomNav from '@/components/MemberBottomNav'

interface Coach        { id: string; name: string }
interface Month        { id: string; year: number; month: number; draft_open?: boolean }
interface FixedSchedule { day: number; time: string }
interface Program      {
  id: string; name: string; unit_minutes: number
  coach_id: string | null; max_students: number
  fixed_schedules: FixedSchedule[] | null
}
interface FamilyMember { id: string; name: string }
interface SlotInfo     { scheduled_at: string; status: string; slot_count?: number; duration_minutes?: number }
interface BlockInfo    { block_date: string | null; block_start: string | null; block_end: string | null; repeat_weekly: boolean; day_of_week: number | null }
interface MyApp {
  id: string; requested_at: string; duration_minutes: number
  lesson_type: string; status: string; coach_note: string | null; admin_note: string | null
  coach: { name: string }; month: { year: number; month: number }
  applicant_name?: string
}

const DAYS_KO = ['일','월','화','수','목','금','토']

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending_coach: { label: '코치 확인 중', color: '#854d0e', bg: '#fef9c3' },
  pending_admin: { label: '승인 대기',    color: '#1d4ed8', bg: '#eff6ff' },
  approved:      { label: '확정',         color: '#15803d', bg: '#dcfce7' },
  rejected:      { label: '거절',         color: '#b91c1c', bg: '#fee2e2' },
}

// ── 개인수업용 날짜 생성 함수 ─────────────────────────────────────
function generateDates(
  year: number, month: number, startDate: Date,
  weekdays: number[], timeStr: string,
  dayTimesMap: Record<number, string>,
  busySlots: SlotInfo[], coachBlocks: BlockInfo[],
  maxStudents: number, duration: number, mySlotKeys: Set<string>
): { dates: Date[]; skipped: { date: string; time: string; reason: string }[] } {
  const dates: Date[] = []
  const skipped: { date: string; time: string; reason: string }[] = []
  const lastDay = new Date(year, month, 0).getDate()

  for (let d = startDate.getDate(); d <= lastDay; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    if (!weekdays.includes(dow)) continue
    const tStr = dayTimesMap[dow] ?? timeStr
    if (!tStr) continue
    const [h, m] = tStr.split(':').map(Number)
    date.setHours(h, m, 0, 0)
    const ymd = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`

    // 휴무 체크
    const [th, tm] = tStr.split(':').map(Number)
    const reqS = th * 60 + tm
    const reqE = reqS + duration
    const blocked = coachBlocks.some(b => {
      if (b.repeat_weekly) { if (b.day_of_week !== dow) return false }
      else { if (b.block_date !== ymd) return false }
      if (!b.block_start && !b.block_end) return true
      const bs = b.block_start ? Number(b.block_start.split(':')[0])*60 + Number(b.block_start.split(':')[1]) : 0
      const be = b.block_end   ? Number(b.block_end.split(':')[0])*60   + Number(b.block_end.split(':')[1])   : 24*60
      return reqS < be && reqE > bs
    })
    if (blocked) { skipped.push({ date: ymd, time: tStr, reason: '코치 휴무' }); continue }

    // 정원 체크
    const matchingSlots = busySlots.filter(s => {
      if (s.status === 'cancelled') return false
      const sd = new Date(new Date(s.scheduled_at).getTime() + 9*60*60*1000)
      const sdIso = sd.toISOString()
      const key16 = `${sdIso.split('T')[0]}T${sdIso.split('T')[1].slice(0,5)}`
      if (mySlotKeys.has(key16)) return false
      if (sdIso.split('T')[0] !== ymd) return false
      const sh = sd.getUTCHours(), sm = sd.getUTCMinutes()
      const slotS = sh*60+sm, slotE = slotS+(s.duration_minutes??duration)
      return reqS < slotE && reqE > slotS
    })
    const effectiveCount = matchingSlots.length > 0
      ? Math.max(...matchingSlots.map((s: any) => s.slot_count ?? 1)) : 0
    if (effectiveCount >= maxStudents) {
      skipped.push({ date: ymd, time: tStr, reason: `정원 초과 (${effectiveCount}/${maxStudents}명)` }); continue
    }
    dates.push(date)
  }
  return { dates, skipped }
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

  const [coaches,     setCoaches]     = useState<Coach[]>([])
  const [months,      setMonths]      = useState<Month[]>([])
  const [allPrograms, setAllPrograms] = useState<Program[]>([])
  const [programs,    setPrograms]    = useState<Program[]>([])
  const [family,      setFamily]      = useState<FamilyMember[]>([])
  const [myApps,      setMyApps]      = useState<MyApp[]>([])
  const [loading,     setLoading]     = useState(true)

  const [applicantType, setApplicantType] = useState<'self'|'family'>('self')
  const [familyId,  setFamilyId]  = useState('')
  const [coachId,   setCoachId]   = useState('')
  const [monthId,   setMonthId]   = useState('')
  const [programId, setProgramId] = useState('')
  const [duration,  setDuration]  = useState(60)

  // 개인수업용 상태
  const [weekOffset,     setWeekOffset]     = useState(0)
  const [busySlots,      setBusySlots]      = useState<SlotInfo[]>([])
  const [coachBlocks,    setCoachBlocks]    = useState<BlockInfo[]>([])
  const [selectedDate,   setSelectedDate]   = useState<Date | null>(null)
  const [selectedTime,   setSelectedTime]   = useState('')
  const [dayTimes,       setDayTimes]       = useState<Record<number, string>>({})
  const [repeatDays,     setRepeatDays]     = useState<number[]>([])
  const [generatedDates, setGeneratedDates] = useState<Date[]>([])
  const [skippedDates,   setSkippedDates]   = useState<{ date: string; time: string; reason: string }[]>([])
  const [excludedIdxs,   setExcludedIdxs]   = useState<Set<number>>(new Set())
  const [mySlotKeys,     setMySlotKeys]     = useState<Set<string>>(new Set())
  const [saving,         setSaving]         = useState(false)
  const [cancelling,     setCancelling]     = useState<string | null>(null)

  const finalDates = generatedDates.filter((_, i) => !excludedIdxs.has(i))

  const selectedProgram = programs.find(p => p.id === programId) ?? null
  const isGroupProgram  = (selectedProgram?.max_students ?? 1) > 1
  const fixedSchedules  = selectedProgram?.fixed_schedules ?? null

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
      const avail = mList.find((x: Month) => !x.draft_open)
      if (avail) setMonthId(avail.id)
      else if (mList.length > 0) setMonthId(mList[0].id)
      const pList = Array.isArray(p) ? p : []
      setAllPrograms(pList)
      setPrograms(pList.filter((x: Program) => x.coach_id === null))
      setFamily(Array.isArray(f) ? f : [])
    })
    loadMyApps()
  }, [])

  const loadMyApps = async () => {
    setLoading(true)
    const [appsRes, scheduleRes] = await Promise.all([
      fetch('/api/lesson-applications?my=1'),
      fetch('/api/my-schedule'),
    ])
    const appsData     = await appsRes.json()
    const scheduleData = await scheduleRes.json()
    setMyApps(Array.isArray(appsData) ? appsData : [])
    const keys = new Set<string>(
      (Array.isArray(scheduleData) ? scheduleData : [])
        .filter((s: any) => s.status === 'scheduled')
        .map((s: any) => s.scheduled_at?.slice(0, 16))
        .filter(Boolean)
    )
    setMySlotKeys(keys)
    setLoading(false)
  }

  useEffect(() => {
    if (!coachId) {
      setPrograms(allPrograms.filter(x => x.coach_id === null))
      setProgramId('')
      return
    }
    fetch(`/api/programs?coach_id=${coachId}`)
      .then(r => r.json())
      .then(d => setPrograms(Array.isArray(d) ? d : []))
    setProgramId('')
  }, [coachId])

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

  // 개인수업 - 일정 자동 생성
  useEffect(() => {
    if (isGroupProgram || !selectedDate || !selectedMonth || !selectedTime) return
    const baseDow = selectedDate.getDay()
    const allDows = Array.from(new Set([...repeatDays, baseDow]))
    const dtMap: Record<number, string> = { ...dayTimes }
    if (!dtMap[baseDow]) dtMap[baseDow] = selectedTime
    const validDows = allDows.filter(dow => !!dtMap[dow])
    if (!validDows.length) return
    const { dates, skipped } = generateDates(
      selectedMonth.year, selectedMonth.month, selectedDate,
      validDows, selectedTime, dtMap,
      busySlots, coachBlocks, 1, duration, mySlotKeys
    )
    setGeneratedDates(dates)
    setSkippedDates(skipped)
    setExcludedIdxs(new Set())
  }, [repeatDays, dayTimes, selectedDate, selectedTime, isGroupProgram])

  const selectedCoach   = coaches.find(c => c.id === coachId)
  const selectedMonth   = months.find(m => m.id === monthId)
  const selectedFamilyM = family.find(f => f.id === familyId)

  const today = new Date(); today.setHours(0,0,0,0)
  const baseMonday = (() => {
    const d = new Date(today)
    const dow = d.getDay()
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    return d
  })()
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseMonday)
    d.setDate(d.getDate() + weekOffset * 7 + i)
    return d
  })
  const TIME_SLOTS = [
    '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
    '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
    '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30',
    '19:00','19:30','20:00','20:30','21:00',
  ]

  const isBlocked = (date: Date, tStr: string) => {
    const kst = new Date(date.getTime() + 9*60*60*1000)
    const ymd = kst.toISOString().split('T')[0]
    const [th, tm] = tStr.split(':').map(Number)
    const slotS = th*60+tm, slotE = slotS+duration
    return coachBlocks.some(b => {
      if (b.repeat_weekly) { if (b.day_of_week !== date.getDay()) return false }
      else { if (b.block_date !== ymd) return false }
      if (!b.block_start && !b.block_end) return true
      const bs = b.block_start ? Number(b.block_start.split(':')[0])*60+Number(b.block_start.split(':')[1]) : 0
      const be = b.block_end   ? Number(b.block_end.split(':')[0])*60+Number(b.block_end.split(':')[1])   : 24*60
      return slotS < be && slotE > bs
    })
  }

  const isBusy = (date: Date, tStr: string) => {
    const toKST = (d: Date) => new Date(d.getTime() + 9*60*60*1000)
    const ymd = toKST(date).toISOString().split('T')[0]
    const [rh, rm] = tStr.split(':').map(Number)
    const reqS = rh*60+rm, reqE = reqS+duration
    const matching = busySlots.filter(s => {
      if (s.status === 'cancelled') return false
      const sd = toKST(new Date(s.scheduled_at))
      const sdIso = sd.toISOString()
      const key16 = `${sdIso.split('T')[0]}T${sdIso.split('T')[1].slice(0,5)}`
      if (mySlotKeys.has(key16)) return false
      if (sdIso.split('T')[0] !== ymd) return false
      const sh = sd.getUTCHours(), sm = sd.getUTCMinutes()
      const sS = sh*60+sm, sE = sS+(s.duration_minutes??duration)
      return reqS < sE && reqE > sS
    })
    const count = matching.length > 0 ? Math.max(...matching.map((s: any) => s.slot_count ?? 1)) : 0
    return count >= (selectedProgram?.max_students ?? 1)
  }

  const isPending = (date: Date, tStr: string) => {
    const kst = new Date(date.getTime() + 9*60*60*1000)
    const ymd = kst.toISOString().split('T')[0]
    const dt = `${ymd}T${tStr}`
    return myApps.some(a => ['pending_coach','pending_admin'].includes(a.status) && a.requested_at?.startsWith(dt.slice(0,16)))
  }

  // ── 그룹수업 신청 ────────────────────────────────────────────────
  const handleGroupSubmit = async () => {
    if (!fixedSchedules || fixedSchedules.length === 0) return alert('고정 스케줄이 없습니다')
    const m = selectedMonth
    if (!m) return
    setSaving(true)

    // ✅ fix #9: KST 오늘 날짜 기준으로 과거 날짜 제외
    const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]

    // 해당 월의 고정 스케줄 날짜 생성 (오늘 이후 + 휴무 제외)
    const lastDay = new Date(m.year, m.month, 0).getDate()
    const slots: string[] = []
    const skippedBlocked: string[] = []

    for (let d = 1; d <= lastDay; d++) {
      const ymd = `${m.year}-${String(m.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      if (ymd < todayKST) continue  // ✅ 오늘 이전 날짜 제외
      const date = new Date(m.year, m.month - 1, d)
      const dow  = date.getDay()
      const sched = fixedSchedules.find(s => s.day === dow)
      if (!sched) continue

      // ✅ fix: 코치 휴무 체크 추가
      const [sh, sm] = sched.time.split(':').map(Number)
      const reqS = sh * 60 + sm
      const reqE = reqS + duration
      const isBlocked = coachBlocks.some(b => {
        if (b.repeat_weekly) { if (b.day_of_week !== dow) return false }
        else { if (b.block_date !== ymd) return false }
        if (!b.block_start && !b.block_end) return true  // 종일 휴무
        const bs = b.block_start ? Number(b.block_start.split(':')[0])*60 + Number(b.block_start.split(':')[1]) : 0
        const be = b.block_end   ? Number(b.block_end.split(':')[0])*60   + Number(b.block_end.split(':')[1])   : 24*60
        return reqS < be && reqE > bs
      })
      if (isBlocked) {
        skippedBlocked.push(ymd)
        continue
      }

      slots.push(`${ymd}T${sched.time}:00+09:00`)
    }

    if (slots.length === 0) { setSaving(false); return alert('남은 수업 날짜가 없습니다') }

    // 휴무로 제외된 날짜 안내
    if (skippedBlocked.length > 0) {
      const msg = `아래 날짜는 코치 휴무로 제외됩니다:\n${skippedBlocked.join(', ')}\n\n나머지 ${slots.length}회로 신청하시겠습니까?`
      if (!confirm(msg)) { setSaving(false); return }
    }

    const res = await fetch('/api/lesson-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coach_id:         coachId,
        month_id:         monthId,
        slots,
        duration_minutes: duration,
        lesson_type:      selectedProgram?.name ?? '그룹레슨',
        family_member_id: applicantType === 'family' ? familyId : null,
        program_id:       programId,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { alert(data.error); return }
    alert(`${slots.length}회 수업 신청 완료!\n코치 확인 후 안내드립니다.`)
    setTab('list'); setStep(1); loadMyApps()
  }

  // ── 개인수업 신청 ────────────────────────────────────────────────
  const handlePersonalSubmit = async () => {
    if (!finalDates.length) return
    setSaving(true)
    const slots = finalDates.map(d => {
      const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const hm  = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      return `${ymd}T${hm}:00+09:00`
    })
    const res = await fetch('/api/lesson-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coach_id: coachId, month_id: monthId, slots,
        duration_minutes: duration,
        lesson_type: selectedProgram?.name ?? '개인레슨',
        family_member_id: applicantType === 'family' ? familyId : null,
        ...(programId ? { program_id: programId } : {}),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { alert(data.error); return }
    alert(`${finalDates.length}회 수업 신청 완료!\n코치 확인 후 안내드립니다.`)
    setTab('list'); setStep(1); loadMyApps()
  }

  const handleCancel = async (appId: string) => {
    if (!confirm('수업 신청을 취소하시겠습니까?')) return
    setCancelling(appId)
    const res = await fetch(`/api/lesson-applications/${appId}`, { method: 'DELETE' })
    const data = await res.json()
    setCancelling(null)
    if (!res.ok) { alert(data.error ?? '취소 실패'); return }
    alert('신청이 취소되었습니다.')
    loadMyApps()
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

  // STEP1 다음 버튼 disabled
  const step1Disabled = !coachId || !monthId || !programId
    || (applicantType === 'family' && !familyId)
    || !!months.find(m => m.id === monthId)?.draft_open

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

      {tab === 'new' && (
        <div style={{ padding: '1rem 1.25rem 6rem' }}>

          {/* ── STEP 1: 기본 정보 (공통) ── */}
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
                    <label style={s.label}>코치</label>
                    <select value={coachId} onChange={e => setCoachId(e.target.value)} style={s.input}>
                      <option value="">코치를 선택해주세요</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={s.label}>수업 월</label>
                    <select value={monthId} onChange={e => setMonthId(e.target.value)} style={s.input}>
                      {months.map(m => (
                        <option key={m.id} value={m.id} disabled={!!m.draft_open}>
                          {m.year}년 {m.month}월{m.draft_open ? ' (일정 준비 중)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={s.label}>
                      프로그램 <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>* 필수</span>
                      {coachId && <span style={{ fontWeight: 400, color: '#3b82f6', marginLeft: '6px' }}>— {coaches.find(c=>c.id===coachId)?.name} 코치</span>}
                    </label>
                    {!coachId ? (
                      <div style={{ padding: '0.625rem', background: '#f9fafb', borderRadius: '0.625rem', border: '1.5px dashed #e5e7eb', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
                        👆 먼저 코치를 선택해주세요
                      </div>
                    ) : programs.length === 0 ? (
                      <div style={{ padding: '0.625rem', background: '#fef9c3', borderRadius: '0.625rem', border: '1.5px solid #fde68a', fontSize: '0.8rem', color: '#854d0e' }}>
                        ⚠️ 등록된 수업 프로그램이 없습니다
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {programs.map(p => {
                          const isGroup = p.max_students > 1
                          const isSelected = programId === p.id
                          return (
                            <button key={p.id}
                              onClick={() => { setProgramId(p.id); setDuration(p.unit_minutes || 60) }}
                              style={{
                                padding: '0.75rem 1rem', borderRadius: '0.75rem', cursor: 'pointer', textAlign: 'left',
                                border: `1.5px solid ${isSelected ? '#16A34A' : '#e5e7eb'}`,
                                background: isSelected ? '#f0fdf4' : 'white',
                                fontFamily: 'Noto Sans KR, sans-serif',
                              }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: isSelected ? '#15803d' : '#111827' }}>{p.name}</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px', background: isGroup ? '#fef9c3' : '#eff6ff', color: isGroup ? '#854d0e' : '#1d4ed8' }}>
                                    {isGroup ? `그룹 최대 ${p.max_students}명` : '개인'}
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: '#9ca3af', padding: '2px 7px' }}>{p.unit_minutes}분</span>
                                </div>
                              </div>
                              {/* 그룹수업 고정 스케줄 미리보기 */}
                              {isGroup && p.fixed_schedules && p.fixed_schedules.length > 0 && (
                                <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {[...p.fixed_schedules].sort((a,b)=>a.day-b.day).map((sch, i) => (
                                    <span key={i} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '9999px', background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>
                                      {DAYS_KO[sch.day]} {sch.time}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {isGroup && (!p.fixed_schedules || p.fixed_schedules.length === 0) && (
                                <div style={{ marginTop: '4px', fontSize: '0.7rem', color: '#9ca3af' }}>스케줄 미등록 (관리자 문의)</div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 그룹수업: 바로 신청 가능 미리보기 */}
              {selectedProgram && isGroupProgram && fixedSchedules && fixedSchedules.length > 0 && (
                <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '1rem', padding: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e40af', marginBottom: '0.75rem' }}>
                    📅 {selectedProgram.name} 수업 일정
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {[...fixedSchedules].sort((a,b)=>a.day-b.day).map((sch, i) => (
                      <div key={i} style={{ padding: '0.5rem 0.875rem', background: 'white', borderRadius: '0.625rem', border: '1.5px solid #93c5fd', fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>
                        매주 {DAYS_KO[sch.day]}요일 {sch.time}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#3b82f6' }}>
                    ※ {selectedMonth?.year}년 {selectedMonth?.month}월 해당 요일 전체 수업이 신청됩니다
                  </div>
                </div>
              )}

              {coachId && !programId && programs.length > 0 && (
                <div style={{ padding: '0.625rem', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '0.75rem', fontSize: '0.8rem', color: '#92400e', textAlign: 'center', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  ⚠️ 프로그램을 선택해주세요
                </div>
              )}

              {/* 그룹수업: 바로 신청 / 개인수업: 다음으로 */}
              {isGroupProgram && fixedSchedules && fixedSchedules.length > 0 ? (
                <button onClick={handleGroupSubmit} disabled={step1Disabled || saving}
                  style={{ ...s.nextBtn(step1Disabled || saving), flex: 'none', width: '100%', fontSize: '1rem' }}>
                  {saving ? '신청 중...' : `🎾 ${selectedProgram?.name} 신청하기`}
                </button>
              ) : (
                <button onClick={() => setStep(2)}
                  disabled={step1Disabled || (isGroupProgram && (!fixedSchedules || fixedSchedules.length === 0))}
                  style={s.nextBtn(step1Disabled || (isGroupProgram && (!fixedSchedules || fixedSchedules.length === 0)))}>
                  {isGroupProgram ? '⚠️ 스케줄 미등록 — 관리자 문의' : '다음 → 날짜 선택'}
                </button>
              )}
            </div>
          )}

          {/* ── STEP 2: 날짜 선택 (개인수업 전용) ── */}
          {step === 2 && !isGroupProgram && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.75rem 1rem', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '0.875rem', fontSize: '0.8rem', color: '#1d4ed8' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>📅 첫 수업 날짜와 시간을 선택하세요</div>
                <div style={{ color: '#3b82f6', lineHeight: 1.5 }}>이 날짜를 기준으로 반복 수업 일정이 자동 생성됩니다</div>
              </div>
              <div style={s.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <button onClick={() => setWeekOffset(w => w-1)} style={{ ...s.btn, padding: '0.375rem 0.75rem' }}>← 이전</button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
                    {weekDates[0].getMonth()+1}/{weekDates[0].getDate()} ~ {weekDates[6].getMonth()+1}/{weekDates[6].getDate()}
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
                          <th key={d.toISOString()} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 2px', textAlign: 'center', color: d.getDay()===0?'#b91c1c':d.getDay()===6?'#1d4ed8':'#374151' }}>
                            {DAYS_KO[d.getDay()]}<br/><span style={{ fontSize: '0.65rem', fontWeight: 400 }}>{d.getDate()}</span>
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
                                <button disabled={isPast || busy || blocked || pending}
                                  onClick={() => { setSelectedDate(new Date(date)); setSelectedTime(tStr) }}
                                  style={{ width: '100%', padding: '3px 0', borderRadius: '4px', border: isSel ? '2px solid #16A34A' : 'none', fontSize: '0.65rem', cursor: (isPast||busy||blocked||pending)?'not-allowed':'pointer', background: isSel?'#16A34A':busy?'#fee2e2':blocked?'#f3f0ff':pending?'#fef9c3':isPast?'#f9fafb':'#f0fdf4', color: isSel?'white':busy?'#fca5a5':blocked?'#7c3aed':pending?'#854d0e':isPast?'#d1d5db':'#15803d' }}>
                                  {isSel?'✓':busy?'✕':blocked?'휴':pending?'…':'○'}
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
                  <div style={{ marginTop: '0.75rem', padding: '0.625rem', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.625rem', fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>
                    ✅ 선택: {fmtDate(selectedDate)} {selectedTime}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(1)} style={s.prevBtn}>← 이전</button>
                <button onClick={() => setStep(3)} disabled={!selectedDate || !selectedTime} style={s.nextBtn(!selectedDate || !selectedTime)}>다음 → 반복 설정</button>
              </div>
            </div>
          )}

          {/* ── STEP 3: 반복 설정 (개인수업 전용) ── */}
          {step === 3 && !isGroupProgram && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#111827' }}>반복 요일 설정</h2>
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.875rem' }}>
                  기본 요일({selectedDate ? DAYS_KO[selectedDate.getDay()] : ''})에 추가로 반복할 요일 선택
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem' }}>
                  {DAYS_KO.map((d, i) => {
                    const isBase = i === selectedDate?.getDay()
                    const isOn   = repeatDays.includes(i) || isBase
                    return (
                      <button key={i}
                        onClick={() => { if (isBase) return; setRepeatDays(prev => prev.includes(i) ? prev.filter(x => x!==i) : [...prev, i]) }}
                        disabled={isBase}
                        style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.5rem', border: `1.5px solid ${isOn?'#16A34A':'#e5e7eb'}`, background: isOn?'#f0fdf4':'white', color: isOn?'#15803d':'#9ca3af', fontWeight: 700, cursor: isBase?'default':'pointer', fontSize: '0.75rem', fontFamily: 'Noto Sans KR, sans-serif', opacity: isBase ? 0.7 : 1 }}>
                        {d}
                      </button>
                    )
                  })}
                </div>
                {repeatDays.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>추가 요일 시간</div>
                    {repeatDays.map(dow => (
                      <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.625rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', minWidth: '20px' }}>{DAYS_KO[dow]}</span>
                        <select value={dayTimes[dow] ?? ''} onChange={e => setDayTimes(prev => ({ ...prev, [dow]: e.target.value }))}
                          style={{ flex: 1, padding: '0.375rem 0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                          <option value="">시간 선택</option>
                          {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
                {generatedDates.length > 0 ? (
                  <>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
                      생성 예정 일정 <span style={{ color: '#16A34A' }}>({generatedDates.length}회)</span>
                      {skippedDates.length > 0 && <span style={{ color: '#d97706', marginLeft: '0.5rem' }}>⚠️ {skippedDates.length}회 제외</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {generatedDates.map((d, i) => (
                        <div key={i} onClick={() => {
                          setExcludedIdxs(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })
                        }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.625rem', background: excludedIdxs.has(i)?'#fef2f2':'#f0fdf4', borderRadius: '0.5rem', cursor: 'pointer', border: `1px solid ${excludedIdxs.has(i)?'#fecaca':'#86efac'}` }}>
                          <span style={{ fontSize: '0.7rem', color: excludedIdxs.has(i)?'#b91c1c':'#16A34A' }}>{excludedIdxs.has(i)?'✕':'✓'}</span>
                          <span style={{ fontSize: '0.78rem', color: excludedIdxs.has(i)?'#9ca3af':'#374151', textDecoration: excludedIdxs.has(i)?'line-through':'none' }}>{fmtDateTime(d)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', background: '#f9fafb', borderRadius: '0.75rem', fontSize: '0.85rem' }}>
                    선택한 날짜 기준으로 일정이 생성됩니다
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(2)} style={s.prevBtn}>← 이전</button>
                <button onClick={() => setStep(4)}
                  disabled={!selectedDate || !selectedTime || repeatDays.some(dow => !dayTimes[dow])}
                  style={s.nextBtn(!selectedDate || !selectedTime || repeatDays.some(dow => !dayTimes[dow]))}>
                  다음 → 미리보기
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: 미리보기 (개인수업 전용) ── */}
          {step === 4 && !isGroupProgram && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>📋 신청 미리보기</h2>
                <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.875rem', padding: '0.875rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', fontSize: '0.8rem' }}>
                    {[
                      ['코치',    `${selectedCoach?.name} 코치`],
                      ['레슨',    selectedProgram?.name ?? '개인레슨'],
                      ['시간',    `${duration}분`],
                      ['수업 월', `${selectedMonth?.year}년 ${selectedMonth?.month}월`],
                      ['총 횟수', `${finalDates.length}회`],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span style={{ color: '#6b7280' }}>{label}</span><br/>
                        <strong style={{ color: label==='총 횟수'?'#16A34A':'#111827', fontSize: label==='총 횟수'?'1.1rem':'0.875rem' }}>{val}</strong>
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
                <div style={{ marginTop: '0.875rem', padding: '0.625rem', background: '#fef9c3', borderRadius: '0.625rem', fontSize: '0.75rem', color: '#854d0e' }}>
                  ※ 금액은 관리자가 별도 입력합니다
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(3)} style={s.prevBtn}>← 수정</button>
                <button onClick={handlePersonalSubmit} disabled={saving}
                  style={{ flex: 2, padding: '0.875rem', borderRadius: '0.875rem', border: 'none', fontWeight: 700, fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif', cursor: saving?'not-allowed':'pointer', background: saving?'#e5e7eb':'#16A34A', color: saving?'#9ca3af':'white' }}>
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
                          {app.coach?.name} 코치{app.lesson_type && ` · ${app.lesson_type}`}
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
                    {app.status === 'pending_coach' && (
                      <button onClick={() => handleCancel(app.id)} disabled={cancelling === app.id}
                        style={{ marginTop: '0.625rem', width: '100%', padding: '0.5rem', borderRadius: '0.625rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 700, cursor: cancelling===app.id?'not-allowed':'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        {cancelling === app.id ? '취소 중...' : '✕ 신청 취소'}
                      </button>
                    )}
                    {app.status === 'pending_admin' && (
                      <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', background: '#eff6ff', borderRadius: '0.5rem', fontSize: '0.72rem', color: '#1d4ed8' }}>
                        ℹ️ 코치 확인 완료. 관리자 최종 승인 대기 중입니다.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <MemberBottomNav />
    </div>
  )
}