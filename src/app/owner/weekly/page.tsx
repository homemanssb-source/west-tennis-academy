'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Slot {
  id: string; scheduled_at: string; duration_minutes: number; status: string; is_makeup: boolean
  display_name: string
  lesson_plan: { lesson_type: string; member: { id: string; name: string }; coach: { id: string; name: string } }
}
interface Block {
  id: string; coach_id: string; block_date: string | null
  block_start: string | null; block_end: string | null
  reason: string | null; repeat_weekly: boolean; day_of_week: number | null
}

const DAYS = ['월','화','수','목','금','토','일']
const START_HOUR = 8, END_HOUR = 22, CELL_MIN = 10, CELL_H = 18
const TOTAL_CELLS = ((END_HOUR - START_HOUR) * 60) / CELL_MIN
const STATUS_COLOR: Record<string,string> = { scheduled:'#16A34A', completed:'#1d4ed8', cancelled:'#b91c1c', makeup:'#7e22ce' }
const STATUS_BG: Record<string,string> = { scheduled:'#f0fdf4', completed:'#eff6ff', cancelled:'#fef2f2', makeup:'#fdf4ff' }
const COACH_COLORS = ['#16A34A','#2563eb','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#65a30d']

function getMonday(d: Date) {
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  mon.setHours(0, 0, 0, 0)
  return mon
}
function toYMD(d: Date) { return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) }

// 슬롯 시작 분 계산 (KST 기준)
function getStartMin(scheduledAt: string) {
  const d = new Date(scheduledAt)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return (kst.getUTCHours() - START_HOUR) * 60 + kst.getUTCMinutes()
}

// 슬롯 KST 날짜 문자열
function getKSTDate(scheduledAt: string) {
  const d = new Date(scheduledAt)
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// 같은 시간(분 단위 동일)끼리 겹침 컬럼 계산
function assignColumns(slots: Slot[]): (Slot & { col: number; totalCols: number })[] {
  // 시작 분 기준으로 그룹핑 (문자열 형식 차이 무시)
  const groups: Record<number, Slot[]> = {}
  for (const s of slots) {
    const key = getStartMin(s.scheduled_at)
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }
  return slots.map(s => {
    const key = getStartMin(s.scheduled_at)
    const group = groups[key]
    const col = group.indexOf(s)
    return { ...s, col, totalCols: group.length }
  })
}

export default function WeeklySchedulePage() {
  const [monday, setMonday] = useState(() => getMonday(new Date()))
  const [slots, setSlots] = useState<Slot[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'all'|'byCoach'>('all')
  const [selCoach, setSelCoach] = useState<string>('all')
  const [selCoachByCoach, setSelCoachByCoach] = useState<string>('')
  const now = new Date()

  useEffect(() => {
    setLoading(true)
    fetch('/api/weekly-schedule?week=' + toYMD(monday))
      .then(r => r.json())
      .then(d => {
        setSlots(Array.isArray(d) ? d : (Array.isArray(d?.slots) ? d.slots : []))
        setBlocks(Array.isArray(d?.blocks) ? d.blocks : [])
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
  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d })
  const coaches = Array.from(new Map(slots.filter(s => s.lesson_plan?.coach).map(s => [s.lesson_plan.coach.id, s.lesson_plan.coach])).values())
  const coachColorMap: Record<string,string> = {}
  coaches.forEach((c, i) => { coachColorMap[c.id] = COACH_COLORS[i % COACH_COLORS.length] })
  const filteredSlots = selCoach === 'all' ? slots : slots.filter(s => s.lesson_plan?.coach?.id === selCoach)

  // 선생님별 첫 코치 자동 선택
  useEffect(() => {
    if (viewMode === 'byCoach' && coaches.length > 0 && !selCoachByCoach) {
      setSelCoachByCoach(coaches[0].id)
    }
  }, [viewMode, coaches, selCoachByCoach])

  function TimeGrid({ slotsForGrid, blocksForGrid }: { slotsForGrid: Slot[]; blocksForGrid: Block[] }) {
    return (
      <div style={{ display:'flex', minWidth:'700px' }}>
        <div style={{ width:'32px', flexShrink:0, marginTop:'40px' }}>
          <div style={{ position:'relative', height:TOTAL_CELLS*CELL_H }}>
            {timeLabels.map((h,i) => (
              <div key={h} style={{ position:'absolute', top:i*6*CELL_H-7, right:2, fontSize:'9px', color:'#9ca3af', fontFamily:'monospace', whiteSpace:'nowrap' }}>{String(h).padStart(2,'0')}</div>
            ))}
          </div>
        </div>
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
          {weekDates.map((date, di) => {
            const ymd = toYMD(date)
            const isToday = ymd === toYMD(now)
            const dow = date.getDay()
            // KST 날짜 기준으로 필터링
            const daySlots = assignColumns(slotsForGrid.filter(s => getKSTDate(s.scheduled_at) === ymd))
            const dayBlocks = blocksForGrid.filter(b =>
              b.repeat_weekly ? b.day_of_week === dow : b.block_date === ymd
            )
            const nowKST = new Date(now.getTime() + 9*60*60*1000)
            const nowMin = isToday ? (nowKST.getUTCHours()-START_HOUR)*60+nowKST.getUTCMinutes() : -1
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
                  {dayBlocks.map(b => {
                    const startMin = b.block_start
                      ? (Number(b.block_start.split(':')[0])*60 + Number(b.block_start.split(':')[1])) - START_HOUR*60
                      : 0
                    const endMin = b.block_end
                      ? (Number(b.block_end.split(':')[0])*60 + Number(b.block_end.split(':')[1])) - START_HOUR*60
                      : (END_HOUR - START_HOUR)*60
                    const top    = Math.max(0, startMin/CELL_MIN*CELL_H)
                    const height = Math.max(CELL_H, (endMin - startMin)/CELL_MIN*CELL_H)
                    return (
                      <div key={b.id} style={{ position:'absolute', top:top+1, left:0, right:0, height:height-1, background:'repeating-linear-gradient(45deg,#f3f0ff,#f3f0ff 4px,#ede9fe 4px,#ede9fe 8px)', borderLeft:'3px solid #7c3aed', zIndex:4, overflow:'hidden', padding:'2px 3px' }}>
                        <div style={{ fontSize:'8px', fontWeight:700, color:'#7c3aed', lineHeight:1.3 }}>휴무</div>
                        {height>=32 && b.reason && <div style={{ fontSize:'8px', color:'#5b21b6', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.reason}</div>}
                      </div>
                    )
                  })}
                  {daySlots.map(slot => {
                    const startMin = getStartMin(slot.scheduled_at)
                    if (startMin < 0 || startMin >= (END_HOUR-START_HOUR)*60) return null
                    const dur    = slot.duration_minutes || 60
                    const top    = (startMin/CELL_MIN)*CELL_H
                    const height = Math.max((dur/CELL_MIN)*CELL_H, CELL_H*3)
                    const status = slot.is_makeup ? 'makeup' : slot.status
                    const coachId = slot.lesson_plan?.coach?.id
                    const color  = viewMode==='byCoach' && coachId ? coachColorMap[coachId] : STATUS_COLOR[status] ?? STATUS_COLOR.scheduled
                    const bg     = viewMode==='byCoach' && coachId ? coachColorMap[coachId]+'18' : STATUS_BG[status] ?? STATUS_BG.scheduled
                    const colW   = 100 / slot.totalCols
                    const leftPct = slot.col * colW
                    // 시간 표시 (KST)
                    const kstD = new Date(new Date(slot.scheduled_at).getTime() + 9*60*60*1000)
                    const hh = String(kstD.getUTCHours()).padStart(2,'0')
                    const mm = String(kstD.getUTCMinutes()).padStart(2,'0')
                    return (
                      <div key={slot.id} style={{
                        position:'absolute', top:top+1,
                        left:`calc(${leftPct}% + 1px)`,
                        width:`calc(${colW}% - 2px)`,
                        height:height-2,
                        background:bg, borderLeft:'3px solid '+color,
                        borderRadius:'0 4px 4px 0', padding:'2px 3px',
                        zIndex:5, overflow:'hidden', boxShadow:'0 1px 2px rgba(0,0,0,0.06)'
                      }}>
                        <div style={{ fontSize:'9px', fontWeight:700, color, lineHeight:1.3 }}>{hh}:{mm}</div>
                        <div style={{ fontSize:'10px', fontWeight:700, color:'#111827', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{slot.display_name}</div>
                        {height>=42 && <div style={{ fontSize:'9px', color:'#6b7280', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{slot.lesson_plan?.coach?.name}</div>}
                        {slot.is_makeup && <div style={{ fontSize:'8px', background:'#e9d5ff', color:'#7e22ce', borderRadius:'9999px', padding:'0 4px', display:'inline-block', marginTop:'1px' }}>보강</div>}
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
      <div style={{ background:'white', borderBottom:'1.5px solid #f3f4f6', padding:'0.875rem 1.25rem', position:'sticky', top:0, zIndex:40, display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
        <Link href='/owner' style={{ color:'#9ca3af', textDecoration:'none', fontSize:'1.25rem' }}>←</Link>
        <h1 style={{ fontFamily:'Oswald,sans-serif', fontSize:'1.25rem', fontWeight:700, color:'#111827' }}>주간 스케줄</h1>
        <div style={{ display:'flex', gap:'3px', background:'#f3f4f6', borderRadius:'0.625rem', padding:'3px' }}>
          <button onClick={() => { setViewMode('all'); setSelCoach('all') }} style={{ padding:'0.25rem 0.75rem', borderRadius:'0.5rem', border:'none', background:viewMode==='all'?'white':'transparent', color:viewMode==='all'?'#111827':'#9ca3af', fontWeight:viewMode==='all'?700:400, fontSize:'0.8rem', cursor:'pointer', whiteSpace:'nowrap' }}>전체 보기</button>
          <button onClick={() => { setViewMode('byCoach'); setSelCoachByCoach(coaches[0]?.id ?? '') }} style={{ padding:'0.25rem 0.75rem', borderRadius:'0.5rem', border:'none', background:viewMode==='byCoach'?'white':'transparent', color:viewMode==='byCoach'?'#111827':'#9ca3af', fontWeight:viewMode==='byCoach'?700:400, fontSize:'0.8rem', cursor:'pointer', whiteSpace:'nowrap' }}>선생님별</button>
        </div>
        {viewMode==='all' && coaches.length>0 && (
          <select value={selCoach} onChange={e => setSelCoach(e.target.value)} style={{ padding:'0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.625rem', background:'white', fontSize:'0.8rem', color:'#374151', cursor:'pointer' }}>
            <option value='all'>전체 코치</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
          </select>
        )}
        {viewMode==='byCoach' && coaches.length>0 && (
          <select value={selCoachByCoach} onChange={e => setSelCoachByCoach(e.target.value)} style={{ padding:'0.375rem 0.75rem', border:'1.5px solid #16A34A', borderRadius:'0.625rem', background:'white', fontSize:'0.8rem', color:'#374151', cursor:'pointer', fontWeight:600 }}>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
          </select>
        )}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <button onClick={() => changeWeek(-1)} style={{ padding:'0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.5rem', background:'white', cursor:'pointer' }}>◀</button>
          <span style={{ fontSize:'0.875rem', fontWeight:700, color:'#111827', whiteSpace:'nowrap' }}>{weekLabel}</span>
          <button onClick={() => changeWeek(1)} style={{ padding:'0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.5rem', background:'white', cursor:'pointer' }}>▶</button>
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>불러오는 중...</div>
      ) : (
        <div style={{ padding:'1rem' }}>
          {viewMode==='all' && (
            <>
              <div style={{ display:'flex', gap:'1rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
                {[['scheduled','예정'],['completed','완료'],['cancelled','결석'],['makeup','보강']].map(([k,l]) => (
                  <div key={k} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.75rem', color:'#6b7280' }}>
                    <div style={{ width:'10px', height:'10px', background:STATUS_COLOR[k], borderRadius:'2px' }}/>{l}
                  </div>
                ))}
              </div>
              <div style={{ overflowX:'auto' }}><TimeGrid slotsForGrid={filteredSlots} blocksForGrid={blocks} /></div>
            </>
          )}
          {viewMode==='byCoach' && (
            <>
              {coaches.length===0 ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>등록된 코치가 없습니다</div>
              ) : selCoachByCoach ? (
                (() => {
                  const coach = coaches.find(c => c.id === selCoachByCoach)
                  const ci    = coaches.findIndex(c => c.id === selCoachByCoach)
                  const color = COACH_COLORS[ci % COACH_COLORS.length]
                  const coachSlots = slots.filter(s => s.lesson_plan?.coach?.id === selCoachByCoach)
                  return (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.625rem 1rem', background:'white', borderRadius:'0.75rem', border:'2px solid '+color, marginBottom:'0.5rem' }}>
                        <div style={{ width:12, height:12, borderRadius:'50%', background:color, flexShrink:0 }}/>
                        <span style={{ fontFamily:'Oswald,sans-serif', fontWeight:700, fontSize:'1rem', color:'#111827' }}>{coach?.name} 코치</span>
                        <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'#6b7280' }}>이번 주 {coachSlots.length}건</span>
                      </div>
                      <div style={{ overflowX:'auto' }}><TimeGrid slotsForGrid={coachSlots} blocksForGrid={blocks.filter(b => b.coach_id === selCoachByCoach)} /></div>
                    </div>
                  )
                })()
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  )
}