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

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#16A34A',
  completed: '#1d4ed8',
  absent:    '#b91c1c',
  makeup:    '#7e22ce',
}

const STATUS_BG: Record<string, string> = {
  scheduled: '#f0fdf4',
  completed: '#eff6ff',
  absent:    '#fef2f2',
  makeup:    '#fdf4ff',
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일']

function getMonday(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
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

  // 요일별 슬롯 분류
  const daySlots = DAYS.map((_, i) => {
    const day = new Date(monday)
    day.setDate(day.getDate() + i)
    const ymd = toYMD(day)
    return slots.filter(s => s.scheduled_at.startsWith(ymd))
  })

  const fmtTime = (dt: string) =>
    new Date(dt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })

  const fmtDate = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}`

  const weekLabel = `${monday.getFullYear()}년 ${monday.getMonth() + 1}월 ${monday.getDate()}일 주`

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>주간 스케줄</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => changeWeek(-1)} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', background: 'white', cursor: 'pointer' }}>‹</button>
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>{weekLabel}</span>
          <button onClick={() => changeWeek(1)} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', background: 'white', cursor: 'pointer' }}>›</button>
        </div>
      </div>

      {/* 주간 그리드 */}
      <div style={{ padding: '1rem', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))', gap: '0.5rem', minWidth: '910px' }}>
            {DAYS.map((day, i) => {
              const date = new Date(monday)
              date.setDate(date.getDate() + i)
              const isToday = toYMD(date) === toYMD(new Date())
              const dSlots = daySlots[i]

              return (
                <div key={i} style={{ background: 'white', borderRadius: '0.875rem', border: `1.5px solid ${isToday ? '#16A34A' : '#f3f4f6'}`, overflow: 'hidden' }}>
                  {/* 요일 헤더 */}
                  <div style={{ background: isToday ? '#16A34A' : '#f9fafb', padding: '0.625rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1rem', color: isToday ? 'white' : '#374151' }}>{day}</div>
                    <div style={{ fontSize: '0.75rem', color: isToday ? 'rgba(255,255,255,.8)' : '#9ca3af' }}>{fmtDate(date)}</div>
                    {dSlots.length > 0 && (
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isToday ? 'rgba(255,255,255,.9)' : '#16A34A', marginTop: '2px' }}>{dSlots.length}건</div>
                    )}
                  </div>

                  {/* 슬롯 목록 */}
                  <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem', minHeight: '80px' }}>
                    {dSlots.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1rem 0', color: '#e5e7eb', fontSize: '0.75rem' }}>없음</div>
                    ) : (
                      dSlots.map(s => {
                        const color = STATUS_COLOR[s.status] ?? STATUS_COLOR.scheduled
                        const bg    = STATUS_BG[s.status]   ?? STATUS_BG.scheduled
                        return (
                          <div key={s.id} style={{ background: bg, borderLeft: `3px solid ${color}`, borderRadius: '0 0.5rem 0.5rem 0', padding: '0.375rem 0.5rem' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color, marginBottom: '1px' }}>{fmtTime(s.scheduled_at)}</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827' }}>{s.lesson_plan?.member?.name}</div>
                            <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>{s.lesson_plan?.coach?.name} 코치</div>
                            {s.is_makeup && <span style={{ fontSize: '0.6rem', background: '#e9d5ff', color: '#7e22ce', borderRadius: '9999px', padding: '1px 5px', fontWeight: 700 }}>보강</span>}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 범례 */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { label: '예정', color: '#16A34A' },
            { label: '완료', color: '#1d4ed8' },
            { label: '결석', color: '#b91c1c' },
            { label: '보강', color: '#7e22ce' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#6b7280' }}>
              <div style={{ width: '10px', height: '10px', background: s.color, borderRadius: '2px' }}></div>
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}