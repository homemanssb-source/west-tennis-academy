'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MemberBottomNav from '@/components/MemberBottomNav'

interface Coach        { id: string; name: string }
interface Month        { id: string; year: number; month: number; draft_open?: boolean }
// ? max_students �߰�
interface Program      { id: string; name: string; unit_minutes: number; coach_id: string | null; default_amount: number; max_students: number }
interface FamilyMember { id: string; name: string; birth_date: string | null }
// ? slot_count �߰� (API���� ��ȯ)
interface SlotInfo     { scheduled_at: string; status: string; slot_count?: number; duration_minutes?: number; lesson_plan?: { member?: { id: string } } | null }
interface BlockInfo    { block_date: string | null; block_start: string | null; block_end: string | null; repeat_weekly: boolean; day_of_week: number | null }
interface MyApp {
  id: string; requested_at: string; duration_minutes: number
  lesson_type: string; status: string; coach_note: string | null; admin_note: string | null
  coach: { name: string }; month: { year: number; month: number }
  applicant_name?: string
}

const DAYS_KO    = ['��','��','ȭ','��','��','��','��']
const DAYS_LABEL = ['��','ȭ','��','��','��','��','��']

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending_coach: { label: '��ġ Ȯ�� ��', color: '#854d0e', bg: '#fef9c3' },
  pending_admin: { label: '���� ���',    color: '#1d4ed8', bg: '#eff6ff' },
  approved:      { label: 'Ȯ��',         color: '#15803d', bg: '#dcfce7' },
  rejected:      { label: '����',         color: '#b91c1c', bg: '#fee2e2' },
}

// ? ����: busySlots + coachBlocks + maxStudents �޾Ƽ� �浹 ��¥ �ڵ� ����
function generateDates(
  year: number, month: number, startDate: Date,
  weekdays: number[], timeStr: string,
  dayTimesMap?: Record<number, string>,
  busySlots?: SlotInfo[],
  coachBlocks?: BlockInfo[],
  maxStudents?: number,
  duration?: number,
  mySlotKeys?: Set<string>
): { dates: Date[]; skipped: { date: string; time: string; reason: string }[] } {
  const dates: Date[] = []
  const skipped: { date: string; time: string; reason: string }[] = []
  const lastDay = new Date(year, month, 0).getDate()
  const max = maxStudents ?? 1

  for (let d = startDate.getDate(); d <= lastDay; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    if (!weekdays.includes(dow)) continue
    const tStr = dayTimesMap?.[dow] ?? timeStr
    if (!tStr) continue
    const [h, m] = tStr.split(':').map(Number)
    date.setHours(h, m, 0, 0)

    const ymd = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`

    // �޹� üũ ? �ð� ������ Ȯ�� (12:00~16:00 �޹��� 11:00 ������ ���)
    const [th, tm] = tStr.split(':').map(Number)
    const reqS = th * 60 + tm
    const reqE = reqS + (duration ?? 60)
    const blocked = (coachBlocks ?? []).some(b => {
      // ����/��¥ üũ
      if (b.repeat_weekly) {
        if (b.day_of_week !== dow) return false
      } else {
        if (b.block_date !== ymd) return false
      }
      // ���� �޹� (�ð� �̼���)
      if (!b.block_start && !b.block_end) return true
      // �ð� ���� ��ħ üũ
      const bs = b.block_start
        ? Number(b.block_start.split(':')[0]) * 60 + Number(b.block_start.split(':')[1])
        : 0
      const be = b.block_end
        ? Number(b.block_end.split(':')[0]) * 60 + Number(b.block_end.split(':')[1])
        : 24 * 60
      return reqS < be && reqE > bs
    })
    if (blocked) {
      skipped.push({ date: ymd, time: tStr, reason: '��ġ �޹�' })
      continue
    }

    // ���� üũ ? �ð� ���� ��ħ ��� (1�ð� �����̸� 11:00~12:00 ������ ����)
    const [rh, rm] = tStr.split(':').map(Number)
    const reqStart = rh * 60 + rm
    const reqEnd   = reqStart + (duration ?? 60)
    const count = (busySlots ?? []).filter(s => {
      if (s.status === 'cancelled') return false
      const sd = new Date(new Date(s.scheduled_at).getTime() + 9 * 60 * 60 * 1000)
      // ? ���� Ȯ�� ������ ī��Ʈ ����
      const sdIso  = sd.toISOString()
      const slotKey16 = `${sdIso.split('T')[0]}T${sdIso.split('T')[1].slice(0,5)}`
      if (mySlotKeys?.has(slotKey16)) return false
      const sdYmd  = sdIso.split('T')[0]
      if (sdYmd !== ymd) return false
      const sh = sd.getUTCHours()
      const sm = sd.getUTCMinutes()
      const slotStart = sh * 60 + sm
      const slotDur   = (s as any).duration_minutes ?? 60
      const slotEnd   = slotStart + slotDur
      return reqStart < slotEnd && reqEnd > slotStart
    }).length
    if (count >= max) {
      skipped.push({ date: ymd, time: tStr, reason: `���� �ʰ� (${count}/${max}��)` })
      continue
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

  const [weekOffset,     setWeekOffset]     = useState(0)
  const [busySlots,      setBusySlots]      = useState<SlotInfo[]>([])
  const [coachBlocks,    setCoachBlocks]    = useState<BlockInfo[]>([])
  const [selectedDate,   setSelectedDate]   = useState<Date | null>(null)
  const [selectedTime,   setSelectedTime]   = useState('')
  const [dayTimes,       setDayTimes]       = useState<Record<number, string>>({})
  const [repeatDays,     setRepeatDays]     = useState<number[]>([])
  // ? ����: generatedDates �� { dates, skipped } ������ ����
  const [generatedDates, setGeneratedDates] = useState<Date[]>([])
  const [skippedDates,   setSkippedDates]   = useState<{ date: string; time: string; reason: string }[]>([])
  const [excludedIdxs,   setExcludedIdxs]   = useState<Set<number>>(new Set())
  const [saving,         setSaving]         = useState(false)
  // ? �߰�: ��� �� ����
  const [cancelling,     setCancelling]     = useState<string | null>(null)
  // ������ �̹� Ȯ���� ���� �ð��� (busySlots ī��Ʈ���� ���ܿ�)
  const [mySlotKeys,     setMySlotKeys]     = useState<Set<string>>(new Set())

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
      // ? draft_open=false�� �� �� ù ��° ���� (draft_open=true�� ���� ���� �Ұ�)
      const availableMonth = mList.find((x: Month) => !x.draft_open)
      if (availableMonth) setMonthId(availableMonth.id)
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
    // ���� Ȯ�� ���� �ð��� ���� (scheduled_at �� 16�ڸ�: YYYY-MM-DDTHH:mm)
    const keys = new Set<string>(
      (Array.isArray(scheduleData) ? scheduleData : [])
        .filter((s: any) => s.status === 'scheduled')
        .map((s: any) => s.scheduled_at?.slice(0, 16))
        .filter(Boolean)
    )
    setMySlotKeys(keys)
    setLoading(false)
  }

  const selectedCoach   = coaches.find(c => c.id === coachId)
  const selectedMonth   = months.find(m => m.id === monthId)
  const selectedProgram = programs.find(p => p.id === programId)
  const selectedFamilyM = family.find(f => f.id === familyId)
  const pendingAppCount = myApps.filter(a => ['pending_coach','pending_admin'].includes(a.status)).length

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
  const TIME_SLOTS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
    '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
    '15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30',
    '19:00','19:30','20:00','20:30','21:00']

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

  const isBlocked = (date: Date, tStr: string) => {
    const kst = new Date(date.getTime() + 9*60*60*1000)
    const ymd = kst.toISOString().split('T')[0]
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
      const bs = b.block_start
        ? (Number(b.block_start.split(':')[0])*60 + Number(b.block_start.split(':')[1]))
        : 0
      const be = b.block_end
        ? (Number(b.block_end.split(':')[0])*60 + Number(b.block_end.split(':')[1]))
        : 24*60
      return slotStart < be && slotEnd > bs
    })
  }

  // ? ����: �ð� ���� ��ħ ��� ���� üũ (1�ð� �����̸� 11:00~12:00 ������ ����)
  const isBusy = (date: Date, tStr: string) => {
    const toKST = (d: Date) => new Date(d.getTime() + 9*60*60*1000)
    const kstDate = toKST(date)
    const ymd = kstDate.toISOString().split('T')[0]
    const maxStudents = selectedProgram?.max_students ?? 1
    const [rh, rm] = tStr.split(':').map(Number)
    const reqStart = rh * 60 + rm
    const reqEnd   = reqStart + duration  // ��û�Ϸ��� �ð����� ��

    const matchingSlots = busySlots.filter(s => {
      if (s.status === 'cancelled') return false
      // ? ���� Ȯ�� ������ ī��Ʈ ���� (���� ������ �־ ���� �� �� ������ ó��)
      const slotKstStr = toKST(new Date(s.scheduled_at)).toISOString()
      const slotKey16  = `${slotKstStr.split('T')[0]}T${slotKstStr.split('T')[1].slice(0,5)}`
      if (mySlotKeys.has(slotKey16)) return false
      const sd = toKST(new Date(s.scheduled_at))
      const sdYmd  = sd.toISOString().split('T')[0]
      if (sdYmd !== ymd) return false
      // ���� ������ �ð� ����
      const sh = sd.getUTCHours()
      const sm = sd.getUTCMinutes()
      const slotStart = sh * 60 + sm
      const slotDur   = (s as any).duration_minutes ?? duration
      const slotEnd   = slotStart + slotDur
      // �ð� ���� ��ħ üũ: �� ������ ��ġ�� busy
      return reqStart < slotEnd && reqEnd > slotStart
    })
    return matchingSlots.length >= maxStudents
  }

  const isPending = (date: Date, tStr: string) => {
    const kst = new Date(date.getTime() + 9*60*60*1000)
    const ymd = kst.toISOString().split('T')[0]
    const dt  = `${ymd}T${tStr}`
    return myApps.some(a =>
      ['pending_coach','pending_admin'].includes(a.status) &&
      a.requested_at?.startsWith(dt.slice(0, 16))
    )
  }

  // ? ����: generateDates�� busySlots/coachBlocks/maxStudents ����
  useEffect(() => {
    if (!selectedDate || !selectedMonth || !selectedTime) return
    const baseDow   = selectedDate.getDay()
    const allDows   = Array.from(new Set([...repeatDays, baseDow]))
    const dtMap: Record<number, string> = { ...dayTimes }
    if (!dtMap[baseDow] && selectedTime) dtMap[baseDow] = selectedTime
    const validDows = allDows.filter(dow => !!dtMap[dow])
    if (validDows.length === 0) return
    const maxStudents = selectedProgram?.max_students ?? 1
    const { dates, skipped } = generateDates(
      selectedMonth.year, selectedMonth.month, selectedDate,
      validDows, selectedTime, dtMap,
      busySlots, coachBlocks, maxStudents, duration, mySlotKeys
    )
    setGeneratedDates(dates)
    setSkippedDates(skipped)
    setExcludedIdxs(new Set())
  }, [repeatDays, dayTimes, selectedDate, selectedTime, selectedMonth, busySlots, coachBlocks, selectedProgram, duration, mySlotKeys])

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
        lesson_type: selectedProgram?.name ?? '���η���',
        family_member_id: applicantType === 'family' ? familyId : null,
        ...(programId ? { program_id: programId } : {}),
      }),
    })
    const d = await res.json()
    setSaving(false)
    if (d.error) { alert(d.error); return }
    alert(`${finalDates.length}ȸ ���� ��û �Ϸ�!\n��ġ Ȯ�� �� �ȳ��帳�ϴ�.`)
    setTab('list'); setStep(1); loadMyApps()
  }

  // ? �߰�: ��û ���
  const handleCancel = async (appId: string) => {
    if (!confirm('���� ��û�� ����Ͻðڽ��ϱ�?\n��� �� ���û�� �ʿ��մϴ�.')) return
    setCancelling(appId)
    const res = await fetch(`/api/lesson-applications/${appId}`, { method: 'DELETE' })
    const d = await res.json()
    setCancelling(null)
    if (!res.ok) { alert(d.error ?? '��� ����'); return }
    alert('��û�� ��ҵǾ����ϴ�.')
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

  const STEP_LABELS = ['�⺻ ����', '��¥ ����', '�ݺ� ����', '�̸�����']

  return (
    <div className="mobile-wrap" style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* ��� */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>?? ���� ��û</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['new','list'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 700, fontSize: '0.85rem', background: tab === t ? '#16A34A' : '#f3f4f6', color: tab === t ? 'white' : '#6b7280' }}>
              {t === 'new' ? '+ �� ��û' : `�� ��û (${myApps.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ���� �� ��û �� ���� */}
      {tab === 'new' && (
        <div style={{ padding: '1rem 1.25rem 6rem' }}>
          {/* ���� �ε������� */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem' }}>
            {STEP_LABELS.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, background: step === i+1 ? '#16A34A' : step > i+1 ? '#86efac' : '#e5e7eb', color: step === i+1 ? 'white' : step > i+1 ? '#15803d' : '#9ca3af' }}>
                    {step > i+1 ? '?' : i+1}
                  </div>
                  <span style={{ fontSize: '0.6rem', color: step === i+1 ? '#16A34A' : '#9ca3af', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap' }}>{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div style={{ flex: 1, height: '2px', background: step > i+1 ? '#86efac' : '#e5e7eb', margin: '0 4px', marginBottom: '14px' }} />
                )}
              </div>
            ))}
          </div>

          {/* ���� STEP 1: �⺻ ���� ���� */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>�⺻ ����</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {family.length > 0 && (
                    <div>
                      <label style={s.label}>��û��</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setApplicantType('self')} style={applicantType === 'self' ? s.btnOn : s.btn}>����</button>
                        <button onClick={() => setApplicantType('family')} style={applicantType === 'family' ? s.btnOn : s.btn}>����</button>
                      </div>
                      {applicantType === 'family' && (
                        <select value={familyId} onChange={e => setFamilyId(e.target.value)} style={{ ...s.input, marginTop: '0.5rem' }}>
                          <option value="">���� ����</option>
                          {family.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                  <div>
                    <label style={s.label}>��ġ ����</label>
                    <select value={coachId} onChange={e => setCoachId(e.target.value)} style={s.input}>
                      <option value="">��ġ�� �������ּ���</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name} ��ġ</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={s.label}>���� ��</label>
                    <select value={monthId} onChange={e => setMonthId(e.target.value)} style={s.input}>
                      {months.map(m => (
                        <option key={m.id} value={m.id} disabled={!!m.draft_open}>
                          {m.year}�� {m.month}��{m.draft_open ? ' (���� �غ� ��)' : ''}
                        </option>
                      ))}
                    </select>
                    {/* draft_open�� ���� ���õ� ��� �ȳ� */}
                    {months.find(m => m.id === monthId)?.draft_open && (
                      <div style={{ marginTop: '0.5rem', padding: '0.625rem 0.875rem', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '0.625rem', fontSize: '0.78rem', color: '#1d4ed8', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        ?? �ش� ���� ��ڰ� ���� ������ �غ� ���̿���.<br/>
                        <strong>������ �� �� ������ �̸�����</strong>���� Ȯ���ϰ� ���� ��û���ּ���.
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={s.label}>
                      ���α׷�
                      {coachId && coaches.find(c => c.id === coachId) && (
                        <span style={{ fontWeight: 400, color: '#3b82f6', marginLeft: '6px' }}>
                          ? {coaches.find(c => c.id === coachId)!.name} ��ġ ����
                        </span>
                      )}
                    </label>
                    {!coachId ? (
                      <div style={{ padding: '0.625rem 0.875rem', background: '#f9fafb', borderRadius: '0.625rem', border: '1.5px dashed #e5e7eb', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
                        ?? ���� ��ġ�� �����ϸ� ���� ���α׷��� ǥ�õ˴ϴ�
                      </div>
                    ) : programs.length === 0 ? (
                      <div style={{ padding: '0.625rem 0.875rem', background: '#fef9c3', borderRadius: '0.625rem', border: '1.5px solid #fde68a', fontSize: '0.8rem', color: '#854d0e' }}>
                        ?? ��ϵ� ���� ���α׷��� �����ϴ�
                      </div>
                    ) : (
                      <select style={s.input} value={programId} onChange={e => {
                        const p = programs.find(x => x.id === e.target.value)
                        if (p) { setProgramId(p.id); setDuration(p.unit_minutes || 60) }
                        else { setProgramId(''); setDuration(60) }
                      }}>
                        <option value="">���α׷��� �����ϼ���</option>
                        {programs.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.coach_id ? '�� ' : ''}{p.name} ({p.unit_minutes}��{p.max_students > 1 ? ` �� �ִ� ${p.max_students}��` : ''})
                          </option>
                        ))}
                      </select>
                    )}
                    {programId && (
                      <div style={{ marginTop: '0.5rem', padding: '0.625rem 0.875rem', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.625rem', fontSize: '0.78rem', color: '#15803d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>?</span>
                        <span>
                          <strong>{programs.find(p => p.id === programId)?.name}</strong>
                          {' �� '}{programs.find(p => p.id === programId)?.unit_minutes}��
                          {(programs.find(p => p.id === programId)?.max_students ?? 1) > 1 &&
                            <span style={{ color: '#1d4ed8' }}> �� �׷� �ִ� {programs.find(p => p.id === programId)?.max_students}��</span>
                          }
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setStep(2)}
                disabled={!coachId || !monthId || (applicantType === 'family' && !familyId) || !!months.find(m => m.id === monthId)?.draft_open}
                style={s.nextBtn(!coachId || !monthId || (applicantType === 'family' && !familyId) || !!months.find(m => m.id === monthId)?.draft_open)}>
                ���� �� ��¥ ����
              </button>
            </div>
          )}

          {/* ���� STEP 2: ��¥ ���� ���� */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* ? �߰�: STEP 2 �ȳ� ��� */}
              <div style={{ padding: '0.75rem 1rem', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '0.875rem', fontSize: '0.8rem', color: '#1d4ed8' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>?? ù ���� ��¥�� �ð��� �����ϼ���</div>
                <div style={{ color: '#3b82f6', lineHeight: 1.5 }}>
                  �� ��¥�� �������� �ݺ� ���� ������ �ڵ� �����˴ϴ�.<br/>
                  ���� �ܰ迡�� �߰� ������ ������ �� �־��.
                </div>
              </div>
              <div style={s.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <button onClick={() => setWeekOffset(w => w-1)} style={{ ...s.btn, padding: '0.375rem 0.75rem' }}>�� ����</button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
                    {weekDates[0].getMonth()+1}/{weekDates[0].getDate()} ~ {weekDates[6].getMonth()+1}/{weekDates[6].getDate()}
                  </span>
                  <button onClick={() => setWeekOffset(w => w+1)} style={{ ...s.btn, padding: '0.375rem 0.75rem' }}>���� ��</button>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.625rem', fontSize: '0.7rem', color: '#6b7280' }}>
                  <span style={{ color: '#15803d' }}>�� ����</span>
                  <span style={{ color: '#b91c1c' }}>? {(selectedProgram?.max_students ?? 1) > 1 ? '��������' : '��������'}</span>
                  <span style={{ color: '#854d0e' }}>�� ��û���</span>
                  <span style={{ color: '#7c3aed' }}>�� ��ġ�޹�</span>
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
                                  {isSel ? '?' : busy ? '?' : blocked ? '��' : pending ? '��' : '��'}
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
                    ? ù ����: {fmtDate(selectedDate)} {selectedTime}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(1)} style={s.prevBtn}>�� ����</button>
                <button onClick={() => setStep(3)} disabled={!selectedDate || !selectedTime} style={s.nextBtn(!selectedDate || !selectedTime)}>���� �� �ݺ� ����</button>
              </div>
            </div>
          )}

          {/* ���� STEP 3: �ݺ� ���� ���� */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* ? �߰�: STEP 3 �ȳ� ��� */}
              <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.875rem', fontSize: '0.8rem', color: '#15803d' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                  ?? ù ����: {selectedDate && fmtDate(selectedDate)} {selectedTime}
                </div>
                <div style={{ color: '#16a34a', lineHeight: 1.5 }}>
                  �� ������ �̹� ���ԵǾ� �־��.<br/>
                  <strong>�߰� ����</strong>�� �����ϸ� �ش� ���ϵ� ���� ��û�ſ�. (���� �� �ص� �˴ϴ�)<br/>
                  �޹����̳� ������ �� ��¥�� �ڵ����� ���ܵ˴ϴ�.
                </div>
              </div>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111827' }}>�ݺ� ���� ����</h2>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.875rem' }}>
                  {fmtDate(selectedDate!)}���� {selectedMonth?.year}�� {selectedMonth?.month}�� ���ϱ���
                </p>

                {repeatDays.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    {repeatDays.map(dow => (
                      <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.625rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', minWidth: '32px' }}>
                          {DAYS_LABEL[dow === 0 ? 6 : dow - 1]}����
                        </span>
                        <select value={dayTimes[dow] ?? ''} onChange={e => setDayTimes(prev => ({ ...prev, [dow]: e.target.value }))} style={{ ...s.input, flex: 1 }}>
                          <option value="">�ð� ����</option>
                          {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    ))}
                    {repeatDays.some(dow => !dayTimes[dow]) && (
                      <div style={{ padding: '0.5rem 0.75rem', background: '#fef9c3', borderRadius: '0.625rem', fontSize: '0.75rem', color: '#854d0e' }}>
                        ?? ��� ������ �ð��� �������ּ���
                      </div>
                    )}
                  </div>
                )}

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

                {/* �ڵ� ���� ���� */}
                {generatedDates.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>�ڵ� ���� ����</span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        <strong style={{ color: '#16A34A' }}>{finalDates.length}ȸ</strong> ��û ����
                        {excludedIdxs.size > 0 && <span style={{ color: '#b91c1c', marginLeft: '0.375rem' }}>({excludedIdxs.size}�� ����)</span>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '2px' }}>
                      {generatedDates.map((d, i) => {
                        const excluded = excludedIdxs.has(i)
                        const rank = generatedDates.slice(0, i).filter((_, j) => !excludedIdxs.has(j)).length + 1
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.625rem', borderRadius: '0.5rem', background: excluded ? '#fef2f2' : '#f0fdf4', border: `1px solid ${excluded ? '#fecaca' : '#bbf7d0'}`, opacity: excluded ? 0.65 : 1 }}>
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: excluded ? '#9ca3af' : '#15803d', minWidth: '28px', textDecoration: excluded ? 'line-through' : 'none' }}>
                              {excluded ? '����' : `${rank}ȸ`}
                            </span>
                            <span style={{ fontSize: '0.82rem', flex: 1, color: excluded ? '#9ca3af' : '#374151', textDecoration: excluded ? 'line-through' : 'none' }}>
                              {fmtDateTime(d)}
                            </span>
                            <button onClick={() => toggleExclude(i)}
                              style={{ fontSize: '0.7rem', fontWeight: 700, border: 'none', borderRadius: '0.375rem', padding: '3px 8px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', background: excluded ? '#dcfce7' : '#fee2e2', color: excluded ? '#15803d' : '#b91c1c', flexShrink: 0 }}>
                              {excluded ? '����' : '����'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    {excludedIdxs.size > 0 && (
                      <button onClick={() => setExcludedIdxs(new Set())}
                        style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.75rem', color: '#6b7280', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 600 }}>
                        ?? ��ü ����
                      </button>
                    )}
                    {/* ? �߰�: �ڵ� ���ܵ� ��¥ �ȳ� */}
                    {skippedDates.length > 0 && (
                      <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.875rem', background: '#fef9c3', border: '1.5px solid #fde68a', borderRadius: '0.625rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#854d0e', marginBottom: '4px' }}>
                          ?? �Ʒ� ��¥�� �ڵ� ���ܵǾ����ϴ�
                        </div>
                        {skippedDates.map((s, i) => (
                          <div key={i} style={{ fontSize: '0.72rem', color: '#92400e', lineHeight: 1.6 }}>
                            ? {s.date} {s.time} ? {s.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', background: '#f9fafb', borderRadius: '0.75rem', fontSize: '0.85rem' }}>
                    ������ ��¥ �������� ������ �����˴ϴ�
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(2)} style={s.prevBtn}>�� ����</button>
                <button onClick={() => setStep(4)}
                  disabled={!selectedDate || !selectedTime || repeatDays.some(dow => !dayTimes[dow])}
                  style={s.nextBtn(!selectedDate || !selectedTime || repeatDays.some(dow => !dayTimes[dow]))}>
                  ���� �� �̸�����
                </button>
              </div>
            </div>
          )}

          {/* ���� STEP 4: �̸����� ���� */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={s.card}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>?? ��û �̸�����</h2>
                <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.875rem', padding: '0.875rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', fontSize: '0.8rem' }}>
                    {[
                      ['��û��',  applicantType === 'family' ? selectedFamilyM?.name ?? '' : '����'],
                      ['��ġ',    `${selectedCoach?.name} ��ġ`],
                      ['����',    selectedProgram?.name ?? '���η���'],
                      ['�ð�',    `${duration}��`],
                      ['���� ��', `${selectedMonth?.year}�� ${selectedMonth?.month}��`],
                      ['�� Ƚ��', `${finalDates.length}ȸ`],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <span style={{ color: '#6b7280' }}>{label}</span><br/>
                        <strong style={{ color: label === '�� Ƚ��' ? '#16A34A' : '#111827', fontSize: label === '�� Ƚ��' ? '1.1rem' : '0.875rem' }}>{val}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>��ü ����</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '220px', overflowY: 'auto' }}>
                  {finalDates.map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', padding: '0.375rem 0.625rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16A34A', minWidth: '28px' }}>{i+1}ȸ</span>
                      <span style={{ fontSize: '0.8rem', color: '#374151' }}>{fmtDateTime(d)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '0.875rem', padding: '0.625rem 0.875rem', background: '#fef9c3', borderRadius: '0.625rem', fontSize: '0.75rem', color: '#854d0e' }}>
                  �� �ݾ��� �����ڰ� ���� �Է��մϴ�
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setStep(3)} style={s.prevBtn}>�� ����</button>
                <button onClick={handleSubmit} disabled={saving}
                  style={{ flex: 2, padding: '0.875rem', borderRadius: '0.875rem', border: 'none', fontWeight: 700, fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#e5e7eb' : '#16A34A', color: saving ? '#9ca3af' : 'white' }}>
                  {saving ? '��û ��...' : `?? ${finalDates.length}ȸ ��û�ϱ�`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ���� �� ��û ��� ���� */}
      {tab === 'list' && (
        <div style={{ padding: '1.25rem', paddingBottom: '6rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>�ҷ����� ��...</div>
          ) : myApps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>??</div>
              <p style={{ fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>��û ������ �����ϴ�</p>
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
                          {app.coach?.name} ��ġ
                          {app.lesson_type && <span> �� {app.lesson_type}</span>}
                          {app.applicant_name && <span style={{ color: '#6b7280', fontWeight: 400 }}> ({app.applicant_name})</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                          {app.month?.year}�� {app.month?.month}�� �� {app.duration_minutes}��
                        </div>
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px', background: st.bg, color: st.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {st.label}
                      </span>
                    </div>
                    {(app.coach_note || app.admin_note) && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.625rem', fontSize: '0.75rem', color: '#6b7280' }}>
                        {app.coach_note && <div>��ġ: {app.coach_note}</div>}
                        {app.admin_note && <div>������: {app.admin_note}</div>}
                      </div>
                    )}
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                      ��û��: {new Date(app.requested_at).toLocaleDateString('ko-KR')}
                    </div>
                    {/* ? �߰�: pending_coach ���¿����� ��� ��ư ǥ�� */}
                    {app.status === 'pending_coach' && (
                      <button
                        onClick={() => handleCancel(app.id)}
                        disabled={cancelling === app.id}
                        style={{ marginTop: '0.625rem', width: '100%', padding: '0.5rem', borderRadius: '0.625rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 700, cursor: cancelling === app.id ? 'not-allowed' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        {cancelling === app.id ? '��� ��...' : '? ��û ���'}
                      </button>
                    )}
                    {app.status === 'pending_admin' && (
                      <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', background: '#eff6ff', borderRadius: '0.5rem', fontSize: '0.72rem', color: '#1d4ed8' }}>
                        ?? ��ġ Ȯ�� �Ϸ�. ������ ���� ���� ��� ���Դϴ�. ��Ҵ� �����ڿ��� �����ϼ���.
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