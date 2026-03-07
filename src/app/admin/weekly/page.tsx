'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Slot {
  id: string; scheduled_at: string; duration_minutes: number; status: string; is_makeup: boolean
  lesson_plan: { lesson_type: string; member: { id: string; name: string }; coach: { id: string; name: string } }
}

const DAYS = ['\uc6d4','\ud654','\uc218','\ubaa9','\uae08','\ud1a0','\uc77c']
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
function toYMD(d: Date) { return d.toISOString().split('T')[0] }

export default function WeeklySchedulePage() {
  const [monday, setMonday] = useState(() => getMonday(new Date()))
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'all'|'byCoach'>('all')
  const [selCoach, setSelCoach] = useState<string>('all')
  const now = new Date()

  useEffect(() => {
    setLoading(true)
    fetch('/api/weekly-schedule?week=' + toYMD(monday))
      .then(r => r.json())
      .then(d => { setSlots(Array.isArray(d) ? d : []); setLoading(false) })
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

  function TimeGrid({ slotsForGrid }: { slotsForGrid: Slot[] }) {
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
            const daySlots = slotsForGrid.filter(s => s.scheduled_at.startsWith(ymd))
            const nowMin = isToday ? (now.getHours()-START_HOUR)*60+now.getMinutes() : -1
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
                  {daySlots.map(slot => {
                    const dt = new Date(slot.scheduled_at)
                    const startMin = (dt.getHours()-START_HOUR)*60+dt.getMinutes()
                    if (startMin < 0 || startMin >= (END_HOUR-START_HOUR)*60) return null
                    const dur = slot.duration_minutes || 30
                    const top = (startMin/CELL_MIN)*CELL_H
                    const height = Math.max((dur/CELL_MIN)*CELL_H, CELL_H*2)
                    const status = slot.is_makeup ? 'makeup' : slot.status
                    const coachId = slot.lesson_plan?.coach?.id
                    const color = viewMode==='byCoach' && coachId ? coachColorMap[coachId] : STATUS_COLOR[status] ?? STATUS_COLOR.scheduled
                    const bg = viewMode==='byCoach' && coachId ? coachColorMap[coachId]+'18' : STATUS_BG[status] ?? STATUS_BG.scheduled
                    return (
                      <div key={slot.id} style={{ position:'absolute', top:top+1, left:2, right:2, height:height-2, background:bg, borderLeft:'3px solid '+color, borderRadius:'0 4px 4px 0', padding:'2px 3px', zIndex:5, overflow:'hidden', boxShadow:'0 1px 2px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize:'9px', fontWeight:700, color, lineHeight:1.3 }}>{String(dt.getHours()).padStart(2,'0')}:{String(dt.getMinutes()).padStart(2,'0')}</div>
                        <div style={{ fontSize:'10px', fontWeight:700, color:'#111827', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{slot.lesson_plan?.member?.name ?? '-'}</div>
                        {height>=42 && <div style={{ fontSize:'9px', color:'#6b7280', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{slot.lesson_plan?.coach?.name}</div>}
                        {slot.is_makeup && <div style={{ fontSize:'8px', background:'#e9d5ff', color:'#7e22ce', borderRadius:'9999px', padding:'0 4px', display:'inline-block', marginTop:'1px' }}>\ubcf4\uac15</div>}
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
        <Link href='/owner' style={{ color:'#9ca3af', textDecoration:'none', fontSize:'1.25rem' }}>\u2190</Link>
        <h1 style={{ fontFamily:'Oswald,sans-serif', fontSize:'1.25rem', fontWeight:700, color:'#111827' }}>\uc8fc\uac04 \uc2a4\ucf00\uc904</h1>
        <div style={{ display:'flex', gap:'3px', background:'#f3f4f6', borderRadius:'0.625rem', padding:'3px' }}>
          <button onClick={() => { setViewMode('all'); setSelCoach('all') }} style={{ padding:'0.25rem 0.75rem', borderRadius:'0.5rem', border:'none', background:viewMode==='all'?'white':'transparent', color:viewMode==='all'?'#111827':'#9ca3af', fontWeight:viewMode==='all'?700:400, fontSize:'0.8rem', cursor:'pointer', whiteSpace:'nowrap' }}>\uc804\uccb4 \ubcf4\uae30</button>
          <button onClick={() => { setViewMode('byCoach'); setSelCoach('all') }} style={{ padding:'0.25rem 0.75rem', borderRadius:'0.5rem', border:'none', background:viewMode==='byCoach'?'white':'transparent', color:viewMode==='byCoach'?'#111827':'#9ca3af', fontWeight:viewMode==='byCoach'?700:400, fontSize:'0.8rem', cursor:'pointer', whiteSpace:'nowrap' }}>\uc120\uc0dd\ub2d8\ubcc4</button>
        </div>
        {viewMode==='all' && coaches.length>0 && (
          <select value={selCoach} onChange={e => setSelCoach(e.target.value)} style={{ padding:'0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.625rem', background:'white', fontSize:'0.8rem', color:'#374151', cursor:'pointer' }}>
            <option value='all'>\uc804\uccb4 \ucf54\uce58</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name} \ucf54\uce58</option>)}
          </select>
        )}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <button onClick={() => changeWeek(-1)} style={{ padding:'0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.5rem', background:'white', cursor:'pointer' }}>\u25c0</button>
          <span style={{ fontSize:'0.875rem', fontWeight:700, color:'#111827', whiteSpace:'nowrap' }}>{weekLabel}</span>
          <button onClick={() => changeWeek(1)} style={{ padding:'0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.5rem', background:'white', cursor:'pointer' }}>\u25b6</button>
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>\ubd88\ub7ec\uc624\ub294 \uc911...</div>
      ) : (
        <div style={{ padding:'1rem' }}>
          {viewMode==='all' && (
            <><div style={{ display:'flex', gap:'1rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
              {[['scheduled','\uc608\uc815'],['completed','\uc644\ub8cc'],['cancelled','\uacb0\uc11d'],['makeup','\ubcf4\uac15']].map(([k,l]) => (
                <div key={k} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.75rem', color:'#6b7280' }}>
                  <div style={{ width:'10px', height:'10px', background:STATUS_COLOR[k], borderRadius:'2px' }}/>{l}
                </div>
              ))}
            </div>
            <div style={{ overflowX:'auto' }}><TimeGrid slotsForGrid={filteredSlots} /></div></>
          )}
          {viewMode==='byCoach' && (
            <>{coaches.length>0 && (
              <div style={{ display:'flex', gap:'1rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
                {coaches.map((c,i) => (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.75rem', color:'#374151', fontWeight:600 }}>
                    <div style={{ width:'10px', height:'10px', background:COACH_COLORS[i%COACH_COLORS.length], borderRadius:'50%' }}/>{c.name}
                  </div>
                ))}
              </div>
            )}
            {coaches.length===0 ? (
              <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>\ub4f1\ub85d\ub41c \ucf54\uce58\uac00 \uc5c6\uc2b5\ub2c8\ub2e4</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'2rem' }}>
                {coaches.map((coach,ci) => {
                  const coachSlots = slots.filter(s => s.lesson_plan?.coach?.id===coach.id)
                  const color = COACH_COLORS[ci%COACH_COLORS.length]
                  return (
                    <div key={coach.id}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.625rem 1rem', background:'white', borderRadius:'0.75rem', border:'2px solid '+color, marginBottom:'0.5rem' }}>
                        <div style={{ width:12, height:12, borderRadius:'50%', background:color, flexShrink:0 }}/>
                        <span style={{ fontFamily:'Oswald,sans-serif', fontWeight:700, fontSize:'1rem', color:'#111827' }}>{coach.name} \ucf54\uce58</span>
                        <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'#6b7280' }}>\uc774\ubc88 \uc8fc {coachSlots.length}\uac74</span>
                      </div>
                      <div style={{ overflowX:'auto' }}><TimeGrid slotsForGrid={coachSlots} /></div>
                    </div>
                  )
                })}
              </div>
            )}</>
          )}
        </div>
      )}
    </div>
  )
}
