'use client'
// src/app/owner/weekly/page.tsx
// ✅ fix: 그룹수업 슬롯 묶어서 표시 (겹침 해소)
// ✅ fix: family_member_name 표시 (가족 신청 시 자녀 이름)
// ✅ fix: KST 기준 날짜 그룹핑 (자정 근처 오표시 수정)
// ✅ fix: 선생님별 탭 드롭다운 필터 추가
// ✅ NEW: "전체 보기" 에서도 선생님 수업이 같은 시간에 겹칠 때 레인 분할로 정렬
// ✅ NEW: 휴무 블록 렌더링 제거 (너무 넓게 깔려서 시야 방해)
// ✅ NEW: 휴대폰 반응형 (가로폭/폰트/헤더 스택)

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SlotActionsModal from '@/components/SlotActionsModal'

interface Slot {
  id: string; scheduled_at: string; duration_minutes: number; status: string; is_makeup: boolean
  family_member_name: string | null
  lesson_plan: { id: string; lesson_type: string; member: { id: string; name: string }; coach: { id: string; name: string } }
}

const DAYS = ['월','화','수','목','금','토','일']
// ✅ #2: END_HOUR 22→24 로 확장 (23시 이후 수업 렌더링 가능)
const START_HOUR = 8, END_HOUR = 24, CELL_MIN = 10
const STATUS_COLOR: Record<string,string> = { scheduled:'#16A34A', completed:'#1d4ed8', cancelled:'#b91c1c', makeup:'#7e22ce' }
const STATUS_BG: Record<string,string>    = { scheduled:'#f0fdf4', completed:'#eff6ff', cancelled:'#fef2f2', makeup:'#fdf4ff' }
const COACH_COLORS = ['#16A34A','#2563eb','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#65a30d']

function getMonday(d: Date) {
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  mon.setHours(0, 0, 0, 0)
  return mon
}

function toYMD(d: Date) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

function slotToKSTDate(scheduled_at: string): string {
  const ms  = new Date(scheduled_at).getTime()
  const kst = new Date(ms + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

/**
 * ✅ #4: per-event width 알고리즘 (기존 cluster 기반 대체)
 *   - Greedy lane 배치 → 각 이벤트의 width 는 "자신과 실제로 겹치는" 이벤트들의 max lane 기반
 *   - 이전 cluster 방식은 체인 상에서 서로 겹치지 않는 이벤트도 같은 폭 강제 → 공간 낭비
 *   - 본 방식은 실제 오버랩 시점에만 분할, 비겹침은 전폭 유지
 */
function layoutDay(groups: { key: string; startMin: number; endMin: number }[]) {
  const sorted = [...groups].sort((a, b) => a.startMin - b.startMin)
  const assigned = new Map<string, number>()
  const laneEnds: number[] = []

  // 1) Greedy lane 배치 (first-fit)
  for (const g of sorted) {
    let lane = laneEnds.findIndex(e => e <= g.startMin)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0) }
    laneEnds[lane] = g.endMin
    assigned.set(g.key, lane)
  }

  // 2) 각 이벤트의 width = 자신과 시간상 겹치는 이벤트들의 max lane + 1
  const clusterSize = new Map<string, number>()
  for (const g of sorted) {
    let maxLane = assigned.get(g.key)!
    for (const o of sorted) {
      // 실제 오버랩 조건: o.start < g.end AND o.end > g.start
      if (o.startMin < g.endMin && o.endMin > g.startMin) {
        maxLane = Math.max(maxLane, assigned.get(o.key)!)
      }
    }
    clusterSize.set(g.key, maxLane + 1)
  }
  return { assigned, clusterSize }
}

export default function WeeklySchedulePage() {
  const [monday, setMonday] = useState(() => getMonday(new Date()))
  const [slots,  setSlots]  = useState<Slot[]>([])
  const [loading, setLoading]   = useState(true)
  const [viewMode, setViewMode] = useState<'all'|'byCoach'>('all')
  const [selCoach, setSelCoach] = useState<string>('all')
  const [isMobile, setIsMobile] = useState(false)
  const [openModalSlots, setOpenModalSlots] = useState<Slot[] | null>(null)
  const now = new Date()

  const reload = () => {
    setLoading(true)
    fetch('/api/weekly-schedule?week=' + toYMD(monday))
      .then(r => r.json())
      .then(d => {
        setSlots(Array.isArray(d) ? d : (Array.isArray(d?.slots) ? d.slots : []))
        setLoading(false)
      })
  }

  // 반응형 플래그 (768px 미만 = 폰)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const CELL_H = isMobile ? 16 : 18
  const TOTAL_CELLS = ((END_HOUR - START_HOUR) * 60) / CELL_MIN
  const MIN_WIDTH = isMobile ? 560 : 700
  const TIME_COL_W = isMobile ? 26 : 32

  useEffect(() => {
    setLoading(true)
    fetch('/api/weekly-schedule?week=' + toYMD(monday))
      .then(r => r.json())
      .then(d => {
        setSlots(Array.isArray(d) ? d : (Array.isArray(d?.slots) ? d.slots : []))
        setLoading(false)
      })
  }, [monday])

  const changeWeek = (dir: number) => {
    const next = new Date(monday)
    next.setDate(next.getDate() + dir * 7)
    setMonday(next)
  }

  const weekEnd = new Date(monday)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekLabel = (monday.getMonth()+1) + '/' + monday.getDate() + ' ~ ' + (weekEnd.getMonth()+1) + '/' + weekEnd.getDate()
  const timeLabels = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)
  const weekDates  = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d })
  const coaches = Array.from(new Map(slots.filter(s => s.lesson_plan?.coach).map(s => [s.lesson_plan.coach.id, s.lesson_plan.coach])).values())
  const coachColorMap: Record<string,string> = {}
  coaches.forEach((c, i) => { coachColorMap[c.id] = COACH_COLORS[i % COACH_COLORS.length] })
  const filteredSlots = selCoach === 'all' ? slots : slots.filter(s => s.lesson_plan?.coach?.id === selCoach)

  function displayName(slot: Slot): string {
    const memberName = slot.lesson_plan?.member?.name ?? '-'
    if (slot.family_member_name) return `${slot.family_member_name}`
    return memberName
  }
  function subName(slot: Slot): string | null {
    if (slot.family_member_name) return `${slot.lesson_plan?.member?.name ?? ''}`
    return null
  }

  function TimeGrid({ slotsForGrid }: { slotsForGrid: Slot[] }) {
    return (
      <div style={{ display:'flex', minWidth: MIN_WIDTH + 'px' }}>
        <div style={{ width: TIME_COL_W + 'px', flexShrink:0, marginTop:'40px' }}>
          <div style={{ position:'relative', height:TOTAL_CELLS*CELL_H }}>
            {timeLabels.map((h,i) => (
              <div key={h} style={{ position:'absolute', top:i*6*CELL_H-7, right:2, fontSize:'9px', color:'#9ca3af', fontFamily:'monospace', whiteSpace:'nowrap' }}>
                {String(h).padStart(2,'0')}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
          {weekDates.map((date, di) => {
            const ymd     = toYMD(date)
            const isToday = ymd === toYMD(now)
            const dow     = date.getDay()
            const daySlots = slotsForGrid.filter(s => slotToKSTDate(s.scheduled_at) === ymd)
            const nowMin = isToday ? (now.getHours()-START_HOUR)*60+now.getMinutes() : -1

            // 1) 같은 시간 + 같은 코치 슬롯을 하나의 그룹으로 묶기 (그룹 레슨 대응)
            const slotGroupMap = new Map<string, Slot[]>()
            daySlots.forEach(s => {
              const dt = new Date(s.scheduled_at)
              const kstH = String(new Date(dt.getTime() + 9*60*60*1000).getUTCHours()).padStart(2,'0')
              const kstM = String(new Date(dt.getTime() + 9*60*60*1000).getUTCMinutes()).padStart(2,'0')
              const key  = `${kstH}:${kstM}_${s.lesson_plan?.coach?.id ?? ''}`
              if (!slotGroupMap.has(key)) slotGroupMap.set(key, [])
              slotGroupMap.get(key)!.push(s)
            })

            // 2) 각 그룹의 시간 범위 계산
            const groupsWithTime = Array.from(slotGroupMap.entries()).map(([key, arr]) => {
              const s = arr[0]
              const dt = new Date(s.scheduled_at)
              const kst = new Date(dt.getTime() + 9*60*60*1000)
              const startMin = (kst.getUTCHours() - START_HOUR) * 60 + kst.getUTCMinutes()
              const dur = s.duration_minutes || 30
              return { key, slots: arr, startMin, endMin: startMin + dur }
            })

            // 3) 레인 배치 (겹치는 클러스터 내에서만 좌우 분할)
            const { assigned, clusterSize } = layoutDay(groupsWithTime)

            return (
              <div key={di} style={{ display:'flex', flexDirection:'column' }}>
                <div style={{ textAlign:'center', height:'40px', background:isToday?'#16A34A':'white', border:'1.5px solid '+(isToday?'#16A34A':'#e5e7eb'), borderRadius:'8px 8px 0 0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ fontFamily:'Oswald,sans-serif', fontWeight:700, fontSize:'0.8rem', color:isToday?'white':dow===0?'#ef4444':dow===6?'#3b82f6':'#374151' }}>{DAYS[di]}</div>
                  <div style={{ fontSize:'0.65rem', color:isToday?'rgba(255,255,255,0.8)':'#9ca3af' }}>{date.getMonth()+1}/{date.getDate()}</div>
                </div>

                <div style={{ position:'relative', height:TOTAL_CELLS*CELL_H, background:'white', border:'1px solid #e5e7eb', borderTop:'none', borderRadius:'0 0 8px 8px', overflow:'hidden' }}>
                  {Array.from({ length:TOTAL_CELLS }, (_,i) => (
                    <div key={i} style={{ position:'absolute', left:0, right:0, top:i*CELL_H, height:CELL_H, borderBottom:i%6===5?'1px solid #e5e7eb':'1px solid #f3f4f6', background:i%6===0?'#fafafa':'transparent' }} />
                  ))}

                  {isToday && nowMin>=0 && nowMin<=(END_HOUR-START_HOUR)*60 && (
                    <div style={{ position:'absolute', left:0, right:0, top:(nowMin/CELL_MIN)*CELL_H, borderTop:'2px solid #ef4444', zIndex:10, display:'flex', alignItems:'center' }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', marginTop:-3, marginLeft:-1, flexShrink:0 }} />
                    </div>
                  )}

                  {groupsWithTime.map(g => {
                    const slot   = g.slots[0]
                    const dt     = new Date(slot.scheduled_at)
                    const kstDt  = new Date(dt.getTime() + 9*60*60*1000)
                    const kstH   = kstDt.getUTCHours()
                    const kstMin = kstDt.getUTCMinutes()
                    if (g.startMin < 0 || g.startMin >= (END_HOUR-START_HOUR)*60) return null
                    const top    = (g.startMin/CELL_MIN)*CELL_H
                    // ✅ #3: 최소 높이 3셀(=30분) → 2셀(=20분) 로 완화
                    //   30분 수업은 여전히 자연스러운 3셀 유지, 10~15분 단축 수업은 2셀
                    const height = Math.max((slot.duration_minutes || 30) / CELL_MIN * CELL_H, CELL_H*2)
                    const status = slot.is_makeup ? 'makeup' : slot.status
                    const coachId = slot.lesson_plan?.coach?.id
                    const color  = viewMode==='byCoach' && coachId ? coachColorMap[coachId] : STATUS_COLOR[status] ?? STATUS_COLOR.scheduled
                    const bg     = viewMode==='byCoach' && coachId ? coachColorMap[coachId]+'18' : STATUS_BG[status] ?? STATUS_BG.scheduled
                    const count  = g.slots.length

                    // 레인 위치 → left/width 퍼센트 계산
                    const lane = assigned.get(g.key) ?? 0
                    const size = clusterSize.get(g.key) ?? 1
                    const leftPct = (lane / size) * 100
                    const widthPct = 100 / size

                    if (count >= 2) {
                      const rawNames = g.slots.map(s =>
                        s.family_member_name ? s.family_member_name : (s.lesson_plan?.member?.name ?? '-')
                      )
                      const names = [...new Set(rawNames)]
                      const groupColor = coachId ? coachColorMap[coachId] ?? '#7c3aed' : '#7c3aed'
                      const groupBg    = groupColor + '18'
                      return (
                        <div key={g.key} onClick={() => setOpenModalSlots(g.slots)}
                          style={{ position:'absolute', top:top+1, left:`calc(${leftPct}% + 2px)`, width:`calc(${widthPct}% - 4px)`, height:height-2, background:groupBg, borderLeft:'3px solid '+groupColor, borderRadius:'0 4px 4px 0', padding:'2px 3px', zIndex:5, overflow:'hidden', boxShadow:'0 1px 2px rgba(0,0,0,0.06)', cursor:'pointer' }}>
                          <div style={{ fontSize:'9px', fontWeight:700, color:groupColor, lineHeight:1.3 }}>
                            {String(kstH).padStart(2,'0')}:{String(kstMin).padStart(2,'0')}
                          </div>
                          <div style={{ fontSize:'8px', fontWeight:700, background:groupColor, color:'white', borderRadius:'9999px', padding:'0 4px', display:'inline-block', marginBottom:'1px' }}>
                            그룹 {names.length}명
                          </div>
                          {names.slice(0, size > 1 ? 2 : 3).map((n, ni) => (
                            <div key={ni} style={{ fontSize:'9px', color:'#111827', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n}</div>
                          ))}
                          {names.length > (size > 1 ? 2 : 3) && (
                            <div style={{ fontSize:'8px', color:'#6b7280' }}>외 {names.length - (size > 1 ? 2 : 3)}명</div>
                          )}
                          {height >= 48 && size === 1 && (
                            <div style={{ fontSize:'9px', color:'#6b7280', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {slot.lesson_plan?.coach?.name}
                            </div>
                          )}
                        </div>
                      )
                    }

                    const name = displayName(slot)
                    const sub  = subName(slot)
                    return (
                      <div key={g.key} onClick={() => setOpenModalSlots(g.slots)}
                        style={{ position:'absolute', top:top+1, left:`calc(${leftPct}% + 2px)`, width:`calc(${widthPct}% - 4px)`, height:height-2, background:bg, borderLeft:'3px solid '+color, borderRadius:'0 4px 4px 0', padding:'2px 3px', zIndex:5, overflow:'hidden', boxShadow:'0 1px 2px rgba(0,0,0,0.06)', cursor:'pointer' }}>
                        <div style={{ fontSize:'9px', fontWeight:700, color, lineHeight:1.3 }}>
                          {String(kstH).padStart(2,'0')}:{String(kstMin).padStart(2,'0')}
                        </div>
                        <div style={{ fontSize:'10px', fontWeight:700, color:'#111827', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
                        {sub && height >= 42 && (
                          <div style={{ fontSize:'8px', color:'#3b82f6', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>({sub})</div>
                        )}
                        {height >= 42 && size === 1 && (
                          <div style={{ fontSize:'9px', color:'#6b7280', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {slot.lesson_plan?.coach?.name}
                          </div>
                        )}
                        {slot.is_makeup && (
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

  return (
    <div style={{ background:'#f9fafb', minHeight:'100vh' }}>
      {/* 헤더 */}
      <div style={{ background:'white', borderBottom:'1.5px solid #f3f4f6', padding: isMobile ? '0.625rem 0.75rem' : '0.875rem 1.25rem', position:'sticky', top:0, zIndex:40, display:'flex', alignItems:'center', gap: isMobile ? '0.5rem' : '0.75rem', flexWrap:'wrap' }}>
        <Link href='/owner' style={{ color:'#9ca3af', textDecoration:'none', fontSize:'1.25rem' }}>←</Link>
        <h1 style={{ fontFamily:'Oswald,sans-serif', fontSize: isMobile ? '1rem' : '1.25rem', fontWeight:700, color:'#111827' }}>주간 스케줄</h1>
        <div style={{ display:'flex', gap:'3px', background:'#f3f4f6', borderRadius:'0.625rem', padding:'3px' }}>
          <button onClick={() => { setViewMode('all'); setSelCoach('all') }}
            style={{ padding: isMobile ? '0.25rem 0.5rem' : '0.25rem 0.75rem', borderRadius:'0.5rem', border:'none', background:viewMode==='all'?'white':'transparent', color:viewMode==='all'?'#111827':'#9ca3af', fontWeight:viewMode==='all'?700:400, fontSize:'0.75rem', cursor:'pointer', whiteSpace:'nowrap' }}>전체 보기</button>
          <button onClick={() => { setViewMode('byCoach'); setSelCoach('all') }}
            style={{ padding: isMobile ? '0.25rem 0.5rem' : '0.25rem 0.75rem', borderRadius:'0.5rem', border:'none', background:viewMode==='byCoach'?'white':'transparent', color:viewMode==='byCoach'?'#111827':'#9ca3af', fontWeight:viewMode==='byCoach'?700:400, fontSize:'0.75rem', cursor:'pointer', whiteSpace:'nowrap' }}>선생님별</button>
        </div>
        {coaches.length > 0 && (
          <select value={selCoach} onChange={e => setSelCoach(e.target.value)}
            style={{ padding: isMobile ? '0.25rem 0.5rem' : '0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.625rem', background:'white', fontSize:'0.75rem', color:'#374151', cursor:'pointer', maxWidth: isMobile ? '130px' : 'none' }}>
            <option value='all'>전체 선생님</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
          </select>
        )}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.375rem' }}>
          <button onClick={() => changeWeek(-1)} style={{ padding: isMobile ? '0.25rem 0.5rem' : '0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.5rem', background:'white', cursor:'pointer', fontSize:'0.75rem' }}>◀</button>
          <span style={{ fontSize: isMobile ? '0.75rem' : '0.875rem', fontWeight:700, color:'#111827', whiteSpace:'nowrap' }}>{weekLabel}</span>
          <button onClick={() => changeWeek(1)} style={{ padding: isMobile ? '0.25rem 0.5rem' : '0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.5rem', background:'white', cursor:'pointer', fontSize:'0.75rem' }}>▶</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>불러오는 중...</div>
      ) : (
        <div style={{ padding: isMobile ? '0.5rem' : '1rem' }}>
          {viewMode==='all' && (
            <>
              <div style={{ display:'flex', gap: isMobile ? '0.625rem' : '1rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
                {[['scheduled','예정'],['completed','완료'],['cancelled','결석'],['makeup','보강']].map(([k,l]) => (
                  <div key={k} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.7rem', color:'#6b7280' }}>
                    <div style={{ width:'10px', height:'10px', background:STATUS_COLOR[k], borderRadius:'2px' }}/>{l}
                  </div>
                ))}
                <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.7rem', color:'#6b7280' }}>
                  <div style={{ width:'10px', height:'10px', background:'#7c3aed', borderRadius:'2px' }}/>그룹수업
                </div>
              </div>
              <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
                <TimeGrid slotsForGrid={filteredSlots} />
              </div>
            </>
          )}
          {viewMode==='byCoach' && (
            <>
              {selCoach === 'all' && coaches.length > 0 && (
                <div style={{ display:'flex', gap: isMobile ? '0.625rem' : '1rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
                  {coaches.map((c,i) => (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.7rem', color:'#374151', fontWeight:600 }}>
                      <div style={{ width:'10px', height:'10px', background:COACH_COLORS[i%COACH_COLORS.length], borderRadius:'50%' }}/>{c.name}
                    </div>
                  ))}
                </div>
              )}
              {coaches.length === 0 ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>등록된 코치가 없습니다</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap: isMobile ? '1.25rem' : '2rem' }}>
                  {coaches
                    .filter(c => selCoach === 'all' || c.id === selCoach)
                    .map(coach => {
                      const ci = coaches.indexOf(coach)
                      const coachSlots = slots.filter(s => s.lesson_plan?.coach?.id === coach.id)
                      const color = COACH_COLORS[ci % COACH_COLORS.length]
                      return (
                        <div key={coach.id}>
                          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding: isMobile ? '0.5rem 0.75rem' : '0.625rem 1rem', background:'white', borderRadius:'0.75rem', border:'2px solid '+color, marginBottom:'0.5rem' }}>
                            <div style={{ width:12, height:12, borderRadius:'50%', background:color, flexShrink:0 }}/>
                            <span style={{ fontFamily:'Oswald,sans-serif', fontWeight:700, fontSize: isMobile ? '0.875rem' : '1rem', color:'#111827' }}>{coach.name} 코치</span>
                            <span style={{ marginLeft:'auto', fontSize:'0.7rem', color:'#6b7280' }}>이번 주 {coachSlots.length}건</span>
                          </div>
                          <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
                            <TimeGrid slotsForGrid={coachSlots} />
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {openModalSlots && (
        <SlotActionsModal
          slots={openModalSlots as any}
          isMobile={isMobile}
          onClose={() => setOpenModalSlots(null)}
          onDone={() => { setOpenModalSlots(null); reload() }}
        />
      )}
    </div>
  )
}
