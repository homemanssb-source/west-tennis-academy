'use client'
// src/app/coach/schedule/page.tsx
// ✅ fix: 주간뷰 슬롯 날짜 그룹핑 KST 기준으로 수정 (자정 근처 오표시 버그)
// ✅ fix: family_member_name 표시 (가족 신청 시 자녀 이름 표시)
// ✅ NEW: 주간 뷰를 운영자 주간 스케줄과 동일한 시간 그리드 레이아웃으로 교체
//        (클릭 시에는 기존 코치용 수업 처리 모달 유지)

import { useEffect, useState, useCallback } from 'react'
import CoachBottomNav from '@/components/CoachBottomNav'

interface Slot {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  slot_type: string
  memo: string | null
  family_member_name: string | null
  lesson_plan: {
    id: string
    lesson_type: string
    member: { id: string; name: string; phone: string }
    coach:  { id: string; name: string }
  }
}

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  scheduled: { bg: '#f0fdf4', border: '#4ade80', color: '#15803d', label: '예정' },
  completed: { bg: '#eff6ff', border: '#60a5fa', color: '#1d4ed8', label: '완료' },
  absent:    { bg: '#fef2f2', border: '#f87171', color: '#b91c1c', label: '결석' },
  makeup:    { bg: '#fdf4ff', border: '#c084fc', color: '#7e22ce', label: '보강' },
}

// ── 운영자 주간 스케줄과 동일한 그리드 상수 ──
const GRID_DAYS = ['월','화','수','목','금','토','일']
const START_HOUR = 8, END_HOUR = 24, CELL_MIN = 10
const STATUS_COLOR_GRID: Record<string,string> = {
  scheduled: '#16A34A', completed: '#1d4ed8', absent: '#b91c1c', cancelled: '#b91c1c', makeup: '#7e22ce',
}
const STATUS_BG_GRID: Record<string,string> = {
  scheduled: '#f0fdf4', completed: '#eff6ff', absent: '#fef2f2', cancelled: '#fef2f2', makeup: '#fdf4ff',
}

// ── 겹치는 그룹만 좌우 분할하는 lane 알고리즘 (owner/weekly 와 동일) ──
function layoutDay(groups: { key: string; startMin: number; endMin: number }[]) {
  const sorted = [...groups].sort((a, b) => a.startMin - b.startMin)
  const assigned = new Map<string, number>()
  const laneEnds: number[] = []
  for (const g of sorted) {
    let lane = laneEnds.findIndex(e => e <= g.startMin)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0) }
    laneEnds[lane] = g.endMin
    assigned.set(g.key, lane)
  }
  const clusterSize = new Map<string, number>()
  for (const g of sorted) {
    let maxLane = assigned.get(g.key)!
    for (const o of sorted) {
      if (o.startMin < g.endMin && o.endMin > g.startMin) {
        maxLane = Math.max(maxLane, assigned.get(o.key)!)
      }
    }
    clusterSize.set(g.key, maxLane + 1)
  }
  return { assigned, clusterSize }
}

// ✅ KST 기준 today
function getTodayKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// ✅ fix: KST 기준 주간 날짜 배열 생성
function getWeekDatesKST(todayKST: string, offset: number): string[] {
  const [y, m, d] = todayKST.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  base.setDate(base.getDate() + offset * 7)
  const dow = base.getDay()
  const monday = new Date(base)
  monday.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const yy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yy}-${mm}-${dd}`
  })
}

// ✅ fix: scheduled_at → KST 날짜 추출
function slotToKSTDate(scheduled_at: string): string {
  const ms  = new Date(scheduled_at).getTime()
  const kst = new Date(ms + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

// ✅ fix: scheduled_at → KST HH:MM
function slotToKSTTime(scheduled_at: string): string {
  const ms  = new Date(scheduled_at).getTime()
  const kst = new Date(ms + 9 * 60 * 60 * 1000)
  return `${String(kst.getUTCHours()).padStart(2,'0')}:${String(kst.getUTCMinutes()).padStart(2,'0')}`
}

// ✅ fix: 표시 이름 — 자녀이름(부모) 형태
function displayName(s: Slot): string {
  if (s.family_member_name) return `${s.family_member_name}(${s.lesson_plan?.member?.name ?? ''})`
  return s.lesson_plan?.member?.name ?? '-'
}

// ── 주간 시간 그리드 (운영자 /owner/weekly 와 동일한 레이아웃) ──
function CoachTimeGrid({
  weekDates,
  todayKST,
  slots,
  isMobile,
  onSlotClick,
  displayName: dispNm,
}: {
  weekDates: string[]
  todayKST: string
  slots: Slot[]
  isMobile: boolean
  onSlotClick: (s: Slot) => void
  displayName: (s: Slot) => string
}) {
  const CELL_H = isMobile ? 16 : 18
  const TOTAL_CELLS = ((END_HOUR - START_HOUR) * 60) / CELL_MIN
  const MIN_WIDTH = isMobile ? 560 : 700
  const TIME_COL_W = isMobile ? 26 : 32
  const timeLabels = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)
  const now = new Date()
  const nowKstHour = (new Date(now.getTime() + 9 * 60 * 60 * 1000)).getUTCHours()
  const nowKstMin  = (new Date(now.getTime() + 9 * 60 * 60 * 1000)).getUTCMinutes()

  return (
    <div style={{ display:'flex', minWidth: MIN_WIDTH + 'px' }}>
      <div style={{ width: TIME_COL_W + 'px', flexShrink: 0, marginTop: '40px' }}>
        <div style={{ position:'relative', height: TOTAL_CELLS * CELL_H }}>
          {timeLabels.map((h, i) => (
            <div key={h} style={{ position:'absolute', top: i*6*CELL_H - 7, right: 2, fontSize:'9px', color:'#9ca3af', fontFamily:'monospace', whiteSpace:'nowrap' }}>
              {String(h).padStart(2,'0')}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
        {weekDates.map((ymd, di) => {
          const [dy, dm, dd] = ymd.split('-').map(Number)
          const dateObj = new Date(dy, dm - 1, dd)
          const isToday = ymd === todayKST
          const dow     = dateObj.getDay()
          const daySlots = slots.filter(s => slotToKSTDate(s.scheduled_at) === ymd)
          const nowMin = isToday ? (nowKstHour - START_HOUR) * 60 + nowKstMin : -1

          // 같은 시간 슬롯을 묶어 그룹 처리 (그룹 레슨 대응) — 코치 본인 1명이라 coach key 는 무관
          const slotGroupMap = new Map<string, Slot[]>()
          daySlots.forEach(s => {
            const dt  = new Date(s.scheduled_at)
            const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000)
            const kstH = String(kst.getUTCHours()).padStart(2,'0')
            const kstM = String(kst.getUTCMinutes()).padStart(2,'0')
            const key = `${kstH}:${kstM}`
            if (!slotGroupMap.has(key)) slotGroupMap.set(key, [])
            slotGroupMap.get(key)!.push(s)
          })

          const groupsWithTime = Array.from(slotGroupMap.entries()).map(([key, arr]) => {
            const s   = arr[0]
            const dt  = new Date(s.scheduled_at)
            const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000)
            const startMin = (kst.getUTCHours() - START_HOUR) * 60 + kst.getUTCMinutes()
            const dur = s.duration_minutes || 30
            return { key, slots: arr, startMin, endMin: startMin + dur }
          })

          const { assigned, clusterSize } = layoutDay(groupsWithTime)

          return (
            <div key={di} style={{ display:'flex', flexDirection:'column' }}>
              <div style={{ textAlign:'center', height:'40px', background: isToday ? '#16A34A' : 'white', border:'1.5px solid ' + (isToday ? '#16A34A' : '#e5e7eb'), borderRadius:'8px 8px 0 0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                <div style={{ fontFamily:'Oswald,sans-serif', fontWeight:700, fontSize:'0.8rem', color: isToday ? 'white' : dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : '#374151' }}>{GRID_DAYS[di]}</div>
                <div style={{ fontSize:'0.65rem', color: isToday ? 'rgba(255,255,255,0.8)' : '#9ca3af' }}>{dm}/{dd}</div>
              </div>

              <div style={{ position:'relative', height: TOTAL_CELLS * CELL_H, background:'white', border:'1px solid #e5e7eb', borderTop:'none', borderRadius:'0 0 8px 8px', overflow:'hidden' }}>
                {Array.from({ length: TOTAL_CELLS }, (_, i) => (
                  <div key={i} style={{ position:'absolute', left:0, right:0, top: i * CELL_H, height: CELL_H, borderBottom: i % 6 === 5 ? '1px solid #e5e7eb' : '1px solid #f3f4f6', background: i % 6 === 0 ? '#fafafa' : 'transparent' }} />
                ))}

                {isToday && nowMin >= 0 && nowMin <= (END_HOUR - START_HOUR) * 60 && (
                  <div style={{ position:'absolute', left:0, right:0, top: (nowMin / CELL_MIN) * CELL_H, borderTop:'2px solid #ef4444', zIndex:10, display:'flex', alignItems:'center' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', marginTop:-3, marginLeft:-1, flexShrink:0 }} />
                  </div>
                )}

                {groupsWithTime.map(g => {
                  const slot = g.slots[0]
                  const dt   = new Date(slot.scheduled_at)
                  const kst  = new Date(dt.getTime() + 9 * 60 * 60 * 1000)
                  const kstH = kst.getUTCHours()
                  const kstM = kst.getUTCMinutes()
                  if (g.startMin < 0 || g.startMin >= (END_HOUR - START_HOUR) * 60) return null
                  const top    = (g.startMin / CELL_MIN) * CELL_H
                  const height = Math.max((slot.duration_minutes || 30) / CELL_MIN * CELL_H, CELL_H * 2)
                  const status = slot.status
                  const color  = STATUS_COLOR_GRID[status] ?? STATUS_COLOR_GRID.scheduled
                  const bg     = STATUS_BG_GRID[status] ?? STATUS_BG_GRID.scheduled
                  const count  = g.slots.length

                  const lane = assigned.get(g.key) ?? 0
                  const size = clusterSize.get(g.key) ?? 1
                  const leftPct  = (lane / size) * 100
                  const widthPct = 100 / size

                  if (count >= 2) {
                    const rawNames = g.slots.map(s =>
                      s.family_member_name ? s.family_member_name : (s.lesson_plan?.member?.name ?? '-'),
                    )
                    const names = [...new Set(rawNames)]
                    const groupColor = '#7c3aed'
                    const groupBg    = groupColor + '18'
                    return (
                      <div key={g.key} onClick={() => onSlotClick(g.slots[0])}
                        style={{ position:'absolute', top: top + 1, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`, height: height - 2, background: groupBg, borderLeft: '3px solid ' + groupColor, borderRadius:'0 4px 4px 0', padding:'2px 3px', zIndex:5, overflow:'hidden', boxShadow:'0 1px 2px rgba(0,0,0,0.06)', cursor:'pointer' }}>
                        <div style={{ fontSize:'9px', fontWeight:700, color: groupColor, lineHeight: 1.3 }}>
                          {String(kstH).padStart(2,'0')}:{String(kstM).padStart(2,'0')}
                        </div>
                        <div style={{ fontSize:'8px', fontWeight:700, background: groupColor, color:'white', borderRadius:'9999px', padding:'0 4px', display:'inline-block', marginBottom:'1px' }}>
                          그룹 {names.length}명
                        </div>
                        {names.slice(0, size > 1 ? 2 : 3).map((n, ni) => (
                          <div key={ni} style={{ fontSize:'9px', color:'#111827', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n}</div>
                        ))}
                        {names.length > (size > 1 ? 2 : 3) && (
                          <div style={{ fontSize:'8px', color:'#6b7280' }}>외 {names.length - (size > 1 ? 2 : 3)}명</div>
                        )}
                      </div>
                    )
                  }

                  const name = dispNm(slot)
                  return (
                    <div key={g.key} onClick={() => onSlotClick(slot)}
                      style={{ position:'absolute', top: top + 1, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`, height: height - 2, background: bg, borderLeft: '3px solid ' + color, borderRadius:'0 4px 4px 0', padding:'2px 3px', zIndex:5, overflow:'hidden', boxShadow:'0 1px 2px rgba(0,0,0,0.06)', cursor:'pointer' }}>
                      <div style={{ fontSize:'9px', fontWeight:700, color, lineHeight:1.3 }}>
                        {String(kstH).padStart(2,'0')}:{String(kstM).padStart(2,'0')}
                      </div>
                      <div style={{ fontSize:'10px', fontWeight:700, color:'#111827', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
                      {height >= 42 && (
                        <div style={{ fontSize:'9px', color:'#6b7280', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {slot.duration_minutes}분 · {slot.lesson_plan?.lesson_type}
                        </div>
                      )}
                      {status === 'makeup' && (
                        <div style={{ fontSize:'8px', background:'#e9d5ff', color:'#7e22ce', borderRadius:'9999px', padding:'0 4px', display:'inline-block', marginTop:'1px' }}>보강</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CoachSchedulePage() {
  const today = getTodayKST()

  const [tab,            setTab]            = useState<'day'|'week'>('day')
  const [date,           setDate]           = useState(today)
  const [coachId,        setCoachId]        = useState('')
  const [slots,          setSlots]          = useState<Slot[]>([])
  const [weekSlots,      setWeekSlots]      = useState<Slot[]>([])
  const [loading,        setLoading]        = useState(false)
  const [selected,       setSelected]       = useState<Slot | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [memo,           setMemo]           = useState('')
  const [showMakeup,     setShowMakeup]     = useState(false)
  const [makeupDate,     setMakeupDate]     = useState('')
  const [makeupTime,     setMakeupTime]     = useState('')
  const [weekOffset,     setWeekOffset]     = useState(0)
  const [showReschedule, setShowReschedule] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [isMobile,       setIsMobile]       = useState(false)

  useEffect(() => {
    fetch('/api/session').then(r => r.json()).then(d => {
      if (d?.id) setCoachId(d.id)
    })
  }, [])

  // 반응형 플래그 (768px 미만 = 폰)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async () => {
    if (!coachId) return
    setLoading(true)
    const res = await fetch(`/api/lesson-slots?date=${date}&coach_id=${coachId}`)
    const data = await res.json()
    setSlots((Array.isArray(data) ? data : []).filter(
      (s: Slot) => s.lesson_plan?.coach?.id === coachId
    ))
    setLoading(false)
  }, [date, coachId])

  const loadWeek = useCallback(async () => {
    if (!coachId) return
    setLoading(true)
    const weekDates = getWeekDatesKST(today, weekOffset)
    const res = await fetch(`/api/lesson-slots?from=${weekDates[0]}&to=${weekDates[6]}&coach_id=${coachId}`)
    const data = await res.json()
    setWeekSlots((Array.isArray(data) ? data : []).filter(
      (s: Slot) => s.lesson_plan?.coach?.id === coachId
    ))
    setLoading(false)
  }, [coachId, weekOffset, today])

  useEffect(() => { if (tab === 'day')  load() },     [load, tab])
  useEffect(() => { if (tab === 'week') loadWeek() }, [loadWeek, tab])

  const reload = () => tab === 'day' ? load() : loadWeek()

  const closeModal = () => {
    setSelected(null)
    setMemo('')
    setShowMakeup(false)
    setShowReschedule(false)
  }

  const handleStatus = async (status: string) => {
    if (!selected) return
    if (status === 'makeup') { setShowMakeup(true); setShowReschedule(false); return }
    setSaving(true)
    await fetch(`/api/lesson-slots/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, memo: memo || null }),
    })
    setSaving(false)
    closeModal()
    reload()
  }

  const handleCancel = async () => {
    if (!selected) return
    const reason = prompt('취소 사유 (선택사항)')
    if (reason === null) return
    setSaving(true)
    await fetch('/api/lesson-slots/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_id: selected.id, reason }),
    })
    setSaving(false)
    closeModal()
    reload()
  }

  const handleMakeupSubmit = async () => {
    if (!selected || !makeupDate || !makeupTime) return
    setSaving(true)
    await fetch('/api/makeup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_slot_id: selected.id,
        makeup_datetime: `${makeupDate}T${makeupTime}:00+09:00`,
      }),
    })
    setSaving(false)
    setShowMakeup(false)
    setMakeupDate('')
    setMakeupTime('')
    closeModal()
    reload()
  }

  const handleRescheduleOpen = () => {
    if (!selected) return
    const kstDate = slotToKSTDate(selected.scheduled_at)
    const kstTime = slotToKSTTime(selected.scheduled_at)
    setRescheduleDate(kstDate)
    setRescheduleTime(kstTime)
    setShowReschedule(true)
    setShowMakeup(false)
  }

  const handleRescheduleSubmit = async () => {
    if (!selected || !rescheduleDate || !rescheduleTime) return
    setSaving(true)
    const res = await fetch(`/api/lesson-slots/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: `${rescheduleDate}T${rescheduleTime}:00+09:00` }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { alert(data.error ?? '수정에 실패했습니다'); return }
    closeModal()
    reload()
  }

  const fmtTime = (dt: string) => slotToKSTTime(dt)

  const changeDate = (days: number) => {
    const [y, m, d] = date.split('-').map(Number)
    const next = new Date(y, m - 1, d)
    next.setDate(next.getDate() + days)
    const yy = next.getFullYear()
    const mm = String(next.getMonth() + 1).padStart(2, '0')
    const dd = String(next.getDate()).padStart(2, '0')
    setDate(`${yy}-${mm}-${dd}`)
  }

  const weekDates = getWeekDatesKST(today, weekOffset)

  const openSlot = (s: Slot) => {
    setSelected(s)
    setMemo(s.memo ?? '')
    setShowMakeup(false)
    setShowReschedule(false)
  }

  const weekLabel = (() => {
    const [f0, f1] = [weekDates[0], weekDates[6]]
    const [, fm, fd] = f0.split('-')
    const [, tm, td] = f1.split('-')
    return `${Number(fm)}/${Number(fd)} ~ ${Number(tm)}/${Number(td)}`
  })()

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>스케줄</div>

        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
          {(['day','week'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '0.625rem', border: 'none', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', background: tab === t ? '#1d4ed8' : '#f3f4f6', color: tab === t ? 'white' : '#6b7280' }}>
              {t === 'day' ? '📅 일간' : '📆 주간'}
            </button>
          ))}
        </div>

        {tab === 'day' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => changeDate(-1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>‹</button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', textAlign: 'center' }} />
            <button onClick={() => changeDate(1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>›</button>
          </div>
        )}

        {tab === 'week' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setWeekOffset(w => w-1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>‹</button>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#111827', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {weekLabel}
            </div>
            <button onClick={() => setWeekOffset(w => w+1)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem' }}>›</button>
          </div>
        )}
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem', overflowY: 'auto' }}>

        {/* 일간 뷰 */}
        {tab === 'day' && (
          loading
            ? <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
            : slots.length === 0
              ? <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
                  <p style={{ fontSize: '0.875rem' }}>이 날 수업이 없습니다</p>
                </div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {slots.map(s => {
                    const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
                    return (
                      <div key={s.id} onClick={() => openSlot(s)}
                        style={{ background: st.bg, borderLeft: `4px solid ${st.border}`, borderRadius: '0 0.875rem 0.875rem 0', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: st.color, flexShrink: 0, width: '48px' }}>{fmtTime(s.scheduled_at)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* ✅ fix: 자녀이름(부모) 표시 */}
                          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{displayName(s)}</div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.duration_minutes}분 · {s.lesson_plan?.lesson_type}</div>
                          {s.memo && <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>📝 {s.memo}</div>}
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: `${st.border}33`, color: st.color, flexShrink: 0 }}>{st.label}</span>
                      </div>
                    )
                  })}
                </div>
        )}

        {/* 주간 뷰 — 운영자 주간 스케줄과 동일한 시간 그리드 */}
        {tab === 'week' && (
          loading
            ? <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
            : (
              <>
                <div style={{ display:'flex', gap: isMobile ? '0.625rem' : '1rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
                  {[['scheduled','예정'],['completed','완료'],['absent','결석'],['makeup','보강']].map(([k,l]) => (
                    <div key={k} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.7rem', color:'#6b7280' }}>
                      <div style={{ width:'10px', height:'10px', background: STATUS_COLOR_GRID[k], borderRadius:'2px' }}/>{l}
                    </div>
                  ))}
                  <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.7rem', color:'#6b7280' }}>
                    <div style={{ width:'10px', height:'10px', background:'#7c3aed', borderRadius:'2px' }}/>그룹수업
                  </div>
                </div>
                <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
                  <CoachTimeGrid
                    weekDates={weekDates}
                    todayKST={today}
                    slots={weekSlots}
                    isMobile={isMobile}
                    onSlotClick={openSlot}
                    displayName={displayName}
                  />
                </div>
              </>
            )
        )}
      </div>

      <CoachBottomNav />

      {/* ── 수업 처리 모달 ── */}
      {selected && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '390px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.25rem 1.25rem 2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>수업 처리</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#9ca3af', cursor: 'pointer', padding: '0 0.25rem' }}>✕</button>
            </div>

            <div style={{ background: '#f9fafb', borderRadius: '0.875rem', padding: '0.875rem 1rem', marginBottom: '1rem' }}>
              {/* ✅ fix: 모달에도 자녀이름(부모) 표시 */}
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{displayName(selected)}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '3px' }}>
                {fmtTime(selected.scheduled_at)} · {selected.duration_minutes}분 · {selected.lesson_plan?.lesson_type}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>메모 (선택)</label>
              <input className="input-base" placeholder="특이사항 입력" value={memo} onChange={e => setMemo(e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {[
                { status: 'completed', label: '✅ 완료',  bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
                { status: 'absent',    label: '❌ 결석',  bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
                { status: 'makeup',    label: '🔁 보강',  bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
                { status: 'scheduled', label: '🔄 예정',  bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
              ].map(btn => (
                <button key={btn.status} onClick={() => handleStatus(btn.status)} disabled={saving}
                  style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${btn.border}`, background: btn.bg, color: btn.color, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', opacity: saving ? 0.6 : 1 }}>
                  {btn.label}
                </button>
              ))}
            </div>

            {selected.status === 'scheduled' && (
              <button onClick={handleRescheduleOpen} disabled={saving}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #fde68a', background: '#fffbeb', color: '#92400e', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                📝 날짜 · 시간 수정
              </button>
            )}

            {showReschedule && (
              <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '0.875rem', padding: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '0.875rem', fontSize: '0.875rem' }}>📝 수업 일정 수정</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.625rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '4px' }}>날짜</label>
                    <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #fde68a', borderRadius: '0.5rem', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '4px' }}>시간</label>
                    <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #fde68a', borderRadius: '0.5rem', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#92400e', background: '#fef3c7', padding: '0.5rem 0.625rem', borderRadius: '0.5rem', marginBottom: '0.625rem' }}>
                  ⚠️ 수정 시 회원에게 변경 알림이 발송됩니다
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowReschedule(false)}
                    style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', background: 'white', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem' }}>
                    취소
                  </button>
                  <button onClick={handleRescheduleSubmit} disabled={!rescheduleDate || !rescheduleTime || saving}
                    style={{ flex: 1, padding: '0.625rem', border: 'none', borderRadius: '0.625rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', color: 'white', cursor: (!rescheduleDate || !rescheduleTime || saving) ? 'not-allowed' : 'pointer', background: (!rescheduleDate || !rescheduleTime || saving) ? '#d1d5db' : '#d97706' }}>
                    {saving ? '수정 중...' : '수정 확정'}
                  </button>
                </div>
              </div>
            )}

            {showMakeup && (
              <div style={{ background: '#fdf4ff', border: '1.5px solid #c084fc', borderRadius: '0.875rem', padding: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 700, color: '#7e22ce', marginBottom: '0.875rem', fontSize: '0.875rem' }}>📅 보강 날짜 선택</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.625rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '4px' }}>날짜</label>
                    <input type="date" value={makeupDate} onChange={e => setMakeupDate(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e9d5ff', borderRadius: '0.5rem', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '4px' }}>시간</label>
                    <input type="time" value={makeupTime} onChange={e => setMakeupTime(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1.5px solid #e9d5ff', borderRadius: '0.5rem', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.85rem', boxSizing: 'border-box' as const }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowMakeup(false)}
                    style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', background: 'white', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem' }}>
                    취소
                  </button>
                  <button onClick={handleMakeupSubmit} disabled={!makeupDate || !makeupTime || saving}
                    style={{ flex: 1, padding: '0.625rem', border: 'none', borderRadius: '0.625rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', color: 'white', cursor: (!makeupDate || !makeupTime || saving) ? 'not-allowed' : 'pointer', background: (!makeupDate || !makeupTime || saving) ? '#d1d5db' : '#7e22ce' }}>
                    {saving ? '처리 중...' : '보강 확정'}
                  </button>
                </div>
              </div>
            )}

            {selected.status !== 'completed' && (
              <button onClick={handleCancel} disabled={saving}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem', opacity: saving ? 0.6 : 1 }}>
                🗑 수업 취소 (회원 알림 발송)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}