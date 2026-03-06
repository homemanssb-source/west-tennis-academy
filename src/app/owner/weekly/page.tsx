'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Slot {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  is_makeup: boolean
  lesson_plan: {
    lesson_type: string
    member: { id: string; name: string }
    coach: { id: string; name: string }
  }
}

const DAYS = ['월','화','수','목','금','토','일']
const START_HOUR = 8
const END_HOUR = 22
const CELL_MIN = 10
const CELL_H = 18 // px per 10min
const TOTAL_CELLS = ((END_HOUR - START_HOUR) * 60) / CELL_MIN

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#16A34A',
  completed: '#1d4ed8',
  cancelled: '#b91c1c',
  makeup:    '#7e22ce',
}

function getMonday(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d)
  mon.setDate(diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function toYMD(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function WeeklySchedulePage() {
  const [monday,  setMonday]  = useState(() => getMonday(new Date()))
  const [slots,   setSlots]   = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const now = new Date()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/weekly-schedule?week=${toYMD(monday)}`)
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
  const weekLabel = `${monday.getMonth()+1}/${monday.getDate()} ~ ${weekEnd.getMonth()+1}/${weekEnd.getDate()}`

  // 시간 라벨 (매 시간)
  const timeLabels = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

  // 날짜별 슬롯
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>주간 스케줄</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => changeWeek(-1)} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>◀</button>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>{weekLabel}</span>
          <button onClick={() => changeWeek(1)} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>▶</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
      ) : (
        <div style={{ padding: '1rem', overflowX: 'auto' }}>
          {/* 범례 */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {[['scheduled','예정'],['completed','완료'],['cancelled','결석'],['makeup','보강']].map(([k,l]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#6b7280' }}>
                <div style={{ width: '10px', height: '10px', background: STATUS_COLOR[k], borderRadius: '2px' }} />{l}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', minWidth: '700px' }}>
            {/* 시간 라벨 컬럼 */}
            <div style={{ width: '36px', flexShrink: 0, position: 'relative', marginTop: '40px' }}>
              <div style={{ position: 'relative', height: TOTAL_CELLS * CELL_H }}>
                {timeLabels.map((h, i) => (
                  <div key={h} style={{
                    position: 'absolute',
                    top: i * 6 * CELL_H - 7,
                    right: 4,
                    fontSize: '10px',
                    color: '#9ca3af',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                  }}>{String(h).padStart(2,'0')}</div>
                ))}
              </div>
            </div>

            {/* 요일 컬럼들 */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {weekDates.map((date, di) => {
                const ymd = toYMD(date)
                const isToday = ymd === toYMD(now)
                const dow = date.getDay()
                const daySlots = slots.filter(s => s.scheduled_at.startsWith(ymd))
                const nowMin = isToday ? (now.getHours() - START_HOUR) * 60 + now.getMinutes() : -1

                return (
                  <div key={di} style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* 요일 헤더 */}
                    <div style={{
                      textAlign: 'center', padding: '6px 2px', height: '40px',
                      background: isToday ? '#16A34A' : 'white',
                      border: `1.5px solid ${isToday ? '#16A34A' : '#e5e7eb'}`,
                      borderRadius: '8px 8px 0 0',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.8rem', color: isToday ? 'white' : dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : '#374151' }}>
                        {DAYS[di]}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: isToday ? 'rgba(255,255,255,0.8)' : '#9ca3af' }}>
                        {date.getMonth()+1}/{date.getDate()}
                      </div>
                    </div>

                    {/* 시간 그리드 */}
                    <div style={{
                      position: 'relative',
                      height: TOTAL_CELLS * CELL_H,
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderTop: 'none',
                      borderRadius: '0 0 8px 8px',
                      overflow: 'hidden',
                    }}>
                      {/* 배경 셀 - 10분 단위 */}
                      {Array.from({ length: TOTAL_CELLS }, (_, i) => (
                        <div key={i} style={{
                          position: 'absolute', left: 0, right: 0,
                          top: i * CELL_H, height: CELL_H,
                          borderBottom: i % 6 === 5 ? '1px solid #e5e7eb' : '1px solid #f9fafb',
                        }} />
                      ))}

                      {/* 현재 시간 선 */}
                      {isToday && nowMin >= 0 && nowMin <= (END_HOUR - START_HOUR) * 60 && (
                        <div style={{
                          position: 'absolute', left: 0, right: 0,
                          top: (nowMin / CELL_MIN) * CELL_H,
                          borderTop: '2px solid #ef4444',
                          zIndex: 10,
                        }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', marginTop: -4, marginLeft: -1 }} />
                        </div>
                      )}

                      {/* 수업 슬롯 */}
                      {daySlots.map(slot => {
                        const dt = new Date(slot.scheduled_at)
                        const startMin = (dt.getHours() - START_HOUR) * 60 + dt.getMinutes()
                        if (startMin < 0 || startMin >= (END_HOUR - START_HOUR) * 60) return null
                        const dur = slot.duration_minutes || 30
                        const top = (startMin / CELL_MIN) * CELL_H
                        const height = Math.max((dur / CELL_MIN) * CELL_H, CELL_H * 2)
                        const status = slot.is_makeup ? 'makeup' : slot.status
                        const color = STATUS_COLOR[status] ?? STATUS_COLOR.scheduled
                        const bgMap: Record<string,string> = { scheduled:'#f0fdf4', completed:'#eff6ff', cancelled:'#fef2f2', makeup:'#fdf4ff' }
                        const bg = bgMap[status] ?? bgMap.scheduled

                        return (
                          <div key={slot.id} style={{
                            position: 'absolute',
                            top, left: 2, right: 2,
                            height,
                            background: bg,
                            borderLeft: `3px solid ${color}`,
                            borderRadius: '0 4px 4px 0',
                            padding: '2px 3px',
                            zIndex: 5,
                            overflow: 'hidden',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color, lineHeight: 1.2 }}>
                              {String(dt.getHours()).padStart(2,'0')}:{String(dt.getMinutes()).padStart(2,'0')}
                            </div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#111827', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {slot.lesson_plan?.member?.name ?? '-'}
                            </div>
                            {height >= 40 && (
                              <div style={{ fontSize: '9px', color: '#6b7280', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {slot.lesson_plan?.coach?.name}
                              </div>
                            )}
                            {slot.is_makeup && (
                              <div style={{ fontSize: '8px', background: '#e9d5ff', color: '#7e22ce', borderRadius: '9999px', padding: '0 4px', display: 'inline-block', marginTop: '1px' }}>보강</div>
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
        </div>
      )}
    </div>
  )
}