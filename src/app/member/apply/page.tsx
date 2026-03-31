'use client'
// src/app/member/apply/page.tsx
// ??洹몃９?섏뾽: 怨좎젙 ?ㅼ?以??먮룞 ?쒖떆 ??1?대┃ ?좎껌
// ??媛쒖씤?섏뾽: 湲곗〈 ?щ젰 ?좏깮 諛⑹떇 ?좎?
// ??fix: draft_open ??registration_open ?쇰줈 ?좎껌 媛??議곌굔 蹂寃?
import { useEffect, useState } from 'react'
import MemberBottomNav from '@/components/MemberBottomNav'

interface Coach        { id: string; name: string }
interface Month        { id: string; year: number; month: number; draft_open?: boolean; registration_open?: boolean }
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

const DAYS_KO = ['??,'??,'??,'??,'紐?,'湲?,'??]

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending_coach: { label: '肄붿튂 ?뺤씤 以?, color: '#854d0e', bg: '#fef9c3' },
  pending_admin: { label: '愿由ъ옄 寃??,  color: '#1d4ed8', bg: '#eff6ff' },
  approved:      { label: '?뺤젙',         color: '#15803d', bg: '#dcfce7' },
  rejected:      { label: '嫄곗젅',         color: '#b91c1c', bg: '#fee2e2' },
}

// ?? 媛쒖씤?섏뾽???좎쭨 ?앹꽦 ?⑥닔 ???????????????????????????????????????????
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
    if (blocked) { skipped.push({ date: ymd, time: tStr, reason: '肄붿튂 ?대Т' }); continue }

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
      skipped.push({ date: ymd, time: tStr, reason: `?뺤썝 珥덇낵 (${effectiveCount}/${maxStudents}紐?` }); continue
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

  // 媛쒖씤?섏뾽???곹깭
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
      // ??registration_open=true ???붿쓣 湲곕낯 ?좏깮
      const avail = mList.find((x: Month) => x.registration_open)
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

  // 媛쒖씤?섏뾽 - ?쇱젙 ?먮룞 ?앹꽦
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

  // ?? 洹몃９?섏뾽 ?좎껌 ?????????????????????????????????????????????????????
  const handleGroupSubmit = async () => {
    if (!fixedSchedules || fixedSchedules.length === 0) return alert('怨좎젙 ?ㅼ?以꾩씠 ?놁뒿?덈떎')
    const m = selectedMonth
    if (!m) return
    setSaving(true)

    const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]

    const lastDay = new Date(m.year, m.month, 0).getDate()
    const slots: string[] = []
    const skippedBlocked: string[] = []

    for (let d = 1; d <= lastDay; d++) {
      const ymd = `${m.year}-${String(m.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      if (ymd < todayKST) continue
      const date = new Date(m.year, m.month - 1, d)
      const dow  = date.getDay()
      const sched = fixedSchedules.find(s => s.day === dow)
      if (!sched) continue

      const [sh, sm] = sched.time.split(':').map(Number)
      const reqS = sh * 60 + sm
      const reqE = reqS + duration
      const isBlockedSlot = coachBlocks.some(b => {
        if (b.repeat_weekly) { if (b.day_of_week !== dow) return false }
        else { if (b.block_date !== ymd) return false }
        if (!b.block_start && !b.block_end) return true
        const bs = b.block_start ? Number(b.block_start.split(':')[0])*60 + Number(b.block_start.split(':')[1]) : 0
        const be = b.block_end   ? Number(b.block_end.split(':')[0])*60   + Number(b.block_end.split(':')[1])   : 24*60
        return reqS < be && reqE > bs
      })
      if (isBlockedSlot) {
        skippedBlocked.push(ymd)
        continue
      }

      slots.push(`${ymd}T${sched.time}:00+09:00`)
    }

    if (slots.length === 0) { setSaving(false); return alert('?⑥? ?섏뾽 ?좎쭨媛 ?놁뒿?덈떎') }

    if (skippedBlocked.length > 0) {
      const msg = `?꾨옒 ?좎쭨??肄붿튂 ?대Т濡??쒖쇅?⑸땲??\n${skippedBlocked.join(', ')}\n\n?섎㉧吏 ${slots.length}?뚮줈 ?좎껌?섏떆寃좎뒿?덇퉴?`
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
        lesson_type:      selectedProgram?.name ?? '洹몃９?덉뒯',
        family_member_id: applicantType === 'family' ? familyId : null,
        program_id:       programId,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { alert(data.error); return }
    alert(`${slots.length}???섏뾽 ?좎껌 ?꾨즺!\n肄붿튂 ?뺤씤 ???덈궡?쒕┰?덈떎.`)
    setTab('list'); setStep(1); loadMyApps()
  }

  // ?? 媛쒖씤?섏뾽 ?좎껌 ?????????????????????????????????????????????????????
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
        lesson_type: selectedProgram?.name ?? '媛쒖씤?덉뒯',
        family_member_id: applicantType === 'family' ? familyId : null,
        ...(programId ? { program_id: programId } : {}),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { alert(data.error); return }
    alert(`${finalDates.length}???섏뾽 ?좎껌 ?꾨즺!\n肄붿튂 ?뺤씤 ???덈궡?쒕┰?덈떎.`)
    setTab('list'); setStep(1); loadMyApps()
  }

  const handleCancel = async (appId: string) => {
    if (!confirm('?섏뾽 ?좎껌??痍⑥냼?섏떆寃좎뒿?덇퉴?')) return
    setCancelling(appId)
    const res = await fetch(`/api/lesson-applications/${appId}`, { method: 'DELETE' })
    const data = await res.json()
    setCancelling(null)
    if (!res.ok) { alert(data.error ?? '痍⑥냼 ?ㅽ뙣'); return }
    alert('?좎껌??痍⑥냼?섏뿀?듬땲??')
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

  // ??registration_open=false ???붿? ?좎껌 遺덇? (draft_open 議곌굔 ?쒓굅)
  const step1Disabled = !coachId || !monthId || !programId
    || (applicantType === 'family' && !familyId)
    || !months.find(m => m.id === monthId)?.registration_open

  return (
    <div className="mobile-wrap" style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* ?ㅻ뜑 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>?렱 ?섏뾽 ?좎껌</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['new','list'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 700, fontSize: '0.85rem', background: tab === t ? '#16A34A' : '#f3f4f6', color: tab === t ? 'white' : '#6b7280' }}>
              {t === 'new' ? '+ ???좎껌' : `???좎껌 (${myApps.length})`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'new' && (
        <div style={{ padding: '1rem 1.25rem 6rem' }}>

          {/* STEP 1: 湲곕낯 ?뺣낫 */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>湲곕낯 ?뺣낫</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

                  {family.length > 0 && (
                    <div>
                      <label style={s.label}>?좎껌??/label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setApplicantType('self')} style={applicantType === 'self' ? s.btnOn : s.btn}>蹂몄씤</button>
                        <button onClick={() => setApplicantType('family')} style={applicantType === 'family' ? s.btnOn : s.btn}>媛議?/button>
                      </div>
                      {applicantType === 'family' && (
                        <select value={familyId} onChange={e => setFamilyId(e.target.value)} style={{ ...s.input, marginTop: '0.5rem' }}>
                          <option value="">媛議??좏깮</option>
                          {family.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}

                  <div>
                    <label style={s.label}>肄붿튂</label>
                    <select value={coachId} onChange={e => setCoachId(e.target.value)} style={s.input}>
                      <option value="">肄붿튂瑜??좏깮?댁＜?몄슂</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 肄붿튂</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={s.label}>?섏뾽 ??/label>
                    <select value={monthId} onChange={e => setMonthId(e.target.value)} style={s.input}>
                      {months.map(m => (
                        <option key={m.id} value={m.id} disabled={!m.registration_open}>
                          {/* ??registration_open=false ??"?쇱젙 以鍮?以?, true ???뺤긽 ?쒖떆 */}
                          {m.year}??{m.month}??!m.registration_open ? ' (?쇱젙 以鍮?以?' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={s.label}>
                      ?꾨줈洹몃옩 <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>* ?꾩닔</span>
                      {coachId && <span style={{ fontWeight: 400, color: '#3b82f6', marginLeft: '6px' }}>??{coaches.find(c=>c.id===coachId)?.name} 肄붿튂</span>}
                    </label>
                    {!coachId ? (
                      <div style={{ padding: '0.625rem', background: '#f9fafb', borderRadius: '0.625rem', border: '1.5px dashed #e5e7eb', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
                        ?몘 癒쇱? 肄붿튂瑜??좏깮?댁＜?몄슂
                      </div>
                    ) : programs.length === 0 ? (
                      <div style={{ padding: '0.625rem', background: '#fef9c3', borderRadius: '0.625rem', border: '1.5px solid #fde68a', fontSize: '0.8rem', color: '#854d0e' }}>
                        ?좑툘 ?깅줉???섏뾽 ?꾨줈洹몃옩???놁뒿?덈떎
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
                                    {isGroup ? `洹몃９ 理쒕? ${p.max_students}紐? : '媛쒖씤'}
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: '#9ca3af', padding: '2px 7px' }}>{p.unit_minutes}遺?/span>
                                </div>
                              </div>
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
                                <div style={{ marginTop: '4px', fontSize: '0.7rem', color: '#9ca3af' }}>?ㅼ?以?誘몃벑濡?(愿由ъ옄 臾몄쓽)</div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 洹몃９?섏뾽: 諛붾줈 ?좎껌 媛??誘몃━蹂닿린 */}
              {selectedProgram && isGroupProgram && fixedSchedules && fixedSchedules.length > 0 && (
                <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '1rem', padding: '1.25rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e40af', marginBottom: '0.75rem' }}>
                    ?뱟 {selectedProgram.name} ?섏뾽 ?쇱젙
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {[...fixedSchedules].sort((a,b)=>a.day-b.day).map((sch, i) => (
                      <div key={i} style={{ padding: '0.5rem 0.875rem', background: 'white', borderRadius: '0.625rem', border: '1.5px solid #93c5fd', fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>
                        留ㅼ＜ {DAYS_KO[sch.day]}?붿씪 {sch.time}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#3b82f6' }}>
                    ?뱦 {selectedMonth?.year}??{selectedMonth?.month}???대떦 ?붿씪 ?꾩껜 ?섏뾽???좎껌?⑸땲??                  </div>
                </div>
              )}

              {coachId && !programId && programs.length > 0 && (
                <div style={{ padding: '0.625rem', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '0.75rem', fontSize: '0.8rem', color: '#92400e', textAlign: 'center', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  ?꾩쓽 ?꾨줈洹몃옩???좏깮?댁＜?몄슂
                </div>
              )}

              {/* ???좎껌 遺덇? ?덈궡 諛곕꼫 */}
              {monthId && !months.find(m => m.id === monthId)?.registration_open && (
                <div style={{ padding: '0.875rem 1rem', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '0.875rem', fontSize: '0.85rem', color: '#92400e', textAlign: 'center', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  ?뵏 ?대떦 ?붿? ?꾩쭅 ?섏뾽 ?좎껌 湲곌컙???꾨떃?덈떎.<br/>
                  <span style={{ fontSize: '0.78rem', color: '#b45309' }}>?쇱젙 以鍮꾧? ?꾨즺?섎㈃ ?덈궡?쒕┰?덈떎.</span>
                </div>
              )}

              {isGroupProgram && fixedSchedules && fixedSchedules.length > 0 ? (
                <button onClick={handleGroupSubmit} disabled={step1Disabled || saving}
                  style={{ ...s.nextBtn(step1Disabled || saving), flex: 'none', width: '100%', fontSize: '1rem' }}>
                  {saving ? '?좎껌 以?..' : `?렱 ${selectedProgram?.name} ?좎껌?섍린`}
                </button>
              ) : (
                <button onClick={() => setStep(2)}
                  disabled={step1Disabled || (isGroupProgram && (!fixedSchedules || fixedSchedules.length === 0))}
                  style={s.nextBtn(step1Disabled || (isGroupProgram && (!fixedSchedules || fixedSchedules.length === 0)))}>
                  {isGroupProgram ? '?좑툘 ?ㅼ?以?誘몃벑濡???愿由ъ옄 臾몄쓽' : '?ㅼ쓬 ???좎쭨 ?좏깮'}
                </button>
              )}
            </div>
          )}

          {/* STEP 2: ?좎쭨 ?좏깮 (媛쒖씤?섏뾽 ?꾩슜) */}
          {step === 2 && !isGroupProgram && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.75rem 1rem', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '0.875rem', fontSize: '0.8rem', color: '#1d4ed8' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>?뱟 泥??섏뾽 ?좎쭨? ?쒓컙???좏깮?섏꽭??/div>
                <div style={{ color: '#3b82f6', lineHeight: 1.5 }}>???좎쭨瑜?湲곗??쇰줈 諛섎났 ?섏뾽 ?쇱젙???먮룞 ?앹꽦?⑸땲??/div>
              </div>
              <div style={s.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <button onClick={() => setWeekOffset(w => w-1)} style={{ ...s.btn, padding: '0.375rem 0.75rem' }}>???댁쟾</button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
                    {weekDates[0].getMonth()+1}/{weekDates[0].getDate()} ~ {weekDates[6].getMonth()+1}/{weekDates[6].getDate()}
                  </span>
                  <button onClick={() => setWeekOffset(w => w+1)} style={{ ...s.btn, padding: '0.375rem 0.75rem' }}>?ㅼ쓬 ??/button>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.625rem', fontSize: '0.7rem', color: '#6b7280' }}>
                  <span style={{ color: '#15803d' }}>??媛??/span>
                  <span style={{ color: '#b91c1c' }}>???섏뾽?덉쓬</span>
                  <span style={{ color: '#854d0e' }}>???좎껌?湲?/span>
                  <span style={{ color: '#7c3aed' }}>??肄붿튂?대Т</span>
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
                                  {isSel?'??:busy?'??:blocked?'??:pending?'??:'??}
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
                    ???좏깮: {fmtDate(selectedDate)} {selectedTime}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(1)} style={s.prevBtn}>???댁쟾</button>
                <button onClick={() => setStep(3)} disabled={!selectedDate || !selectedTime} style={s.nextBtn(!selectedDate || !selectedTime)}>?ㅼ쓬 ??諛섎났 ?ㅼ젙</button>
              </div>
            </div>
          )}

          {/* STEP 3: 諛섎났 ?ㅼ젙 (媛쒖씤?섏뾽 ?꾩슜) */}
          {step === 3 && !isGroupProgram && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#111827' }}>諛섎났 ?붿씪 ?ㅼ젙</h2>
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.875rem' }}>
                  湲곕낯 ?붿씪({selectedDate ? DAYS_KO[selectedDate.getDay()] : ''})??異붽?濡?諛섎났???붿씪 ?좏깮
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
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>異붽? ?붿씪 ?쒓컙</div>
                    {repeatDays.map(dow => (
                      <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.625rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', minWidth: '20px' }}>{DAYS_KO[dow]}</span>
                        <select value={dayTimes[dow] ?? ''} onChange={e => setDayTimes(prev => ({ ...prev, [dow]: e.target.value }))}
                          style={{ flex: 1, padding: '0.375rem 0.5rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                          <option value="">?쒓컙 ?좏깮</option>
                          {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
                {generatedDates.length > 0 ? (
                  <>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
                      ?앹꽦 ?덉젙 ?쇱젙 <span style={{ color: '#16A34A' }}>({generatedDates.length}??</span>
                      {skippedDates.length > 0 && <span style={{ color: '#d97706', marginLeft: '0.5rem' }}>?먮룞 {skippedDates.length}???쒖쇅</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {generatedDates.map((d, i) => (
                        <div key={i} onClick={() => {
                          setExcludedIdxs(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })
                        }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.625rem', background: excludedIdxs.has(i)?'#fef2f2':'#f0fdf4', borderRadius: '0.5rem', cursor: 'pointer', border: `1px solid ${excludedIdxs.has(i)?'#fecaca':'#86efac'}` }}>
                          <span style={{ fontSize: '0.7rem', color: excludedIdxs.has(i)?'#b91c1c':'#16A34A' }}>{excludedIdxs.has(i)?'??:'??}</span>
                          <span style={{ fontSize: '0.78rem', color: excludedIdxs.has(i)?'#9ca3af':'#374151', textDecoration: excludedIdxs.has(i)?'line-through':'none' }}>{fmtDateTime(d)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', background: '#f9fafb', borderRadius: '0.75rem', fontSize: '0.85rem' }}>
                    ?좏깮???좎쭨 湲곗??쇰줈 ?쇱젙???앹꽦?⑸땲??                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(2)} style={s.prevBtn}>???댁쟾</button>
                <button onClick={() => setStep(4)}
                  disabled={!selectedDate || !selectedTime || repeatDays.some(dow => !dayTimes[dow])}
                  style={s.nextBtn(!selectedDate || !selectedTime || repeatDays.some(dow => !dayTimes[dow]))}>
                  ?ㅼ쓬 ??誘몃━蹂닿린
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: 誘몃━蹂닿린 (媛쒖씤?섏뾽 ?꾩슜) */}
          {step === 4 && !isGroupProgram && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>???좎껌 誘몃━蹂닿린</h2>
                <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.875rem', padding: '0.875rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', fontSize: '0.8rem' }}>
                    {[
                      ['肄붿튂',    `${selectedCoach?.name} 肄붿튂`],
                      ['醫낅쪟',    selectedProgram?.name ?? '媛쒖씤?덉뒯'],
                      ['?쒓컙',    `${duration}遺?],
                      ['?섏뾽 ??, `${selectedMonth?.year}??${selectedMonth?.month}??],
                      ['珥??잛닔', `${finalDates.length}??],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span style={{ color: '#6b7280' }}>{label}</span><br/>
                        <strong style={{ color: label==='珥??잛닔'?'#16A34A':'#111827', fontSize: label==='珥??잛닔'?'1.1rem':'0.875rem' }}>{val}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>?꾩껜 ?쇱젙</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '220px', overflowY: 'auto' }}>
                  {finalDates.map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.375rem 0.625rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16A34A', minWidth: '28px' }}>{i+1}??/span>
                      <span style={{ fontSize: '0.8rem', color: '#374151' }}>{fmtDateTime(d)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '0.875rem', padding: '0.625rem', background: '#fef9c3', borderRadius: '0.625rem', fontSize: '0.75rem', color: '#854d0e' }}>
                  ?좑툘 理쒖쥌 ?뺤젙? 愿由ъ옄媛 ?뱀씤?⑸땲??                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(3)} style={s.prevBtn}>???섏젙</button>
                <button onClick={handlePersonalSubmit} disabled={saving}
                  style={{ flex: 2, padding: '0.875rem', borderRadius: '0.875rem', border: 'none', fontWeight: 700, fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif', cursor: saving?'not-allowed':'pointer', background: saving?'#e5e7eb':'#16A34A', color: saving?'#9ca3af':'white' }}>
                  {saving ? '?좎껌 以?..' : `?렱 ${finalDates.length}???좎껌?섍린`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ???좎껌 紐⑸줉 */}
      {tab === 'list' && (
        <div style={{ padding: '1.25rem', paddingBottom: '6rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>遺덈윭?ㅻ뒗 以?..</div>
          ) : myApps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>?렱</div>
              <p style={{ fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>?좎껌 ?댁뿭???놁뒿?덈떎</p>
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
                          {app.coach?.name} 肄붿튂{app.lesson_type && ` 쨌 ${app.lesson_type}`}
                          {app.applicant_name && <span style={{ color: '#6b7280', fontWeight: 400 }}> ({app.applicant_name})</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                          {app.month?.year}??{app.month?.month}??쨌 {app.duration_minutes}遺?                        </div>
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px', background: st.bg, color: st.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {st.label}
                      </span>
                    </div>
                    {(app.coach_note || app.admin_note) && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.625rem', fontSize: '0.75rem', color: '#6b7280' }}>
                        {app.coach_note && <div>肄붿튂: {app.coach_note}</div>}
                        {app.admin_note && <div>愿由ъ옄: {app.admin_note}</div>}
                      </div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                      ?좎껌?? {new Date(app.requested_at).toLocaleDateString('ko-KR')}
                    </div>
                    {app.status === 'pending_coach' && (
                      <button onClick={() => handleCancel(app.id)} disabled={cancelling === app.id}
                        style={{ marginTop: '0.625rem', width: '100%', padding: '0.5rem', borderRadius: '0.625rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 700, cursor: cancelling===app.id?'not-allowed':'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        {cancelling === app.id ? '痍⑥냼 以?..' : '?뿊 ?좎껌 痍⑥냼'}
                      </button>
                    )}
                    {app.status === 'pending_admin' && (
                      <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', background: '#eff6ff', borderRadius: '0.5rem', fontSize: '0.72rem', color: '#1d4ed8' }}>
                        ?대? 肄붿튂 ?뺤씤 ?꾨즺. 愿由ъ옄 理쒖쥌 ?뱀씤 ?湲곗쨷?낅땲??
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
