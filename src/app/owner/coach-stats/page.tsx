'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface CoachStat {
  id: string
  name: string
  totalSlots: number
  completedSlots: number
  absentSlots: number
  scheduledSlots: number
  attendanceRate: number
  totalMinutes: number
  memberCount: number
  planCount: number
  typeMap: Record<string, number>
}

interface Month { id: string; year: number; month: number }

export default function CoachStatsPage() {
  const [months,   setMonths]   = useState<Month[]>([])
  const [monthId,  setMonthId]  = useState('')
  const [stats,    setStats]    = useState<CoachStat[]>([])
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    fetch('/api/months').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d.sort((a: Month, b: Month) => b.year !== a.year ? b.year - a.year : b.month - a.month) : []
      setMonths(list)
      if (list.length > 0) setMonthId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!monthId) return
    setLoading(true)
    fetch(`/api/coach-stats?month_id=${monthId}`).then(r => r.json()).then(d => {
      setStats(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [monthId])

  const maxSlots = Math.max(...stats.map(s => s.totalSlots), 1)

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>코치 수업 부하</h1>
        <select value={monthId} onChange={e => setMonthId(e.target.value)}
          style={{ marginLeft: 'auto', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', background: 'white', cursor: 'pointer' }}>
          {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
        </select>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : stats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎾</div>
            <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>이번 달 수업 데이터가 없습니다</div>
          </div>
        ) : (
          <>
            {/* 코치 비교 바 차트 */}
            <div style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', color: '#111827' }}>수업 횟수 비교</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {stats.map(c => (
                  <div key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                      <span>🎾 {c.name} 코치</span>
                      <span style={{ color: '#6b7280', fontWeight: 400 }}>총 {c.totalSlots}회 · 회원 {c.memberCount}명</span>
                    </div>
                    {/* 완료/예정/결석 스택바 */}
                    <div style={{ height: '28px', background: '#f3f4f6', borderRadius: '0.5rem', overflow: 'hidden', display: 'flex' }}>
                      {c.completedSlots > 0 && (
                        <div style={{ width: `${c.completedSlots / maxSlots * 100}%`, background: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'white', fontWeight: 700, minWidth: c.completedSlots > 0 ? '20px' : '0', transition: 'width 0.6s ease' }}>
                          {c.completedSlots}
                        </div>
                      )}
                      {c.scheduledSlots > 0 && (
                        <div style={{ width: `${c.scheduledSlots / maxSlots * 100}%`, background: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'white', fontWeight: 700, minWidth: c.scheduledSlots > 0 ? '20px' : '0', transition: 'width 0.6s ease' }}>
                          {c.scheduledSlots}
                        </div>
                      )}
                      {c.absentSlots > 0 && (
                        <div style={{ width: `${c.absentSlots / maxSlots * 100}%`, background: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'white', fontWeight: 700, minWidth: c.absentSlots > 0 ? '16px' : '0', transition: 'width 0.6s ease' }}>
                          {c.absentSlots}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '4px', fontSize: '0.7rem', color: '#9ca3af' }}>
                      <span style={{ color: '#1d4ed8' }}>■ 완료 {c.completedSlots}</span>
                      <span style={{ color: '#d97706' }}>■ 예정 {c.scheduledSlots}</span>
                      <span style={{ color: '#ef4444' }}>■ 결석 {c.absentSlots}</span>
                      <span style={{ marginLeft: 'auto', color: c.attendanceRate >= 80 ? '#15803d' : c.attendanceRate >= 60 ? '#854d0e' : '#b91c1c', fontWeight: 700 }}>출석률 {c.attendanceRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 상세 테이블 */}
            <div style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', overflow: 'hidden' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', color: '#111827' }}>상세 비교</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['코치', '회원수', '총수업', '완료', '결석', '예정', '출석률', '총시간'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: '#6b7280', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map(c => (
                      <tr key={c.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>🎾 {c.name}</td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: '#6b7280' }}>{c.memberCount}명</td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 700, color: '#111827' }}>{c.totalSlots}</td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: '#1d4ed8', fontWeight: 600 }}>{c.completedSlots}</td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: c.absentSlots > 0 ? '#b91c1c' : '#d1d5db', fontWeight: c.absentSlots > 0 ? 600 : 400 }}>{c.absentSlots}</td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: '#d97706' }}>{c.scheduledSlots}</td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                          <span style={{ background: c.attendanceRate >= 80 ? '#dcfce7' : c.attendanceRate >= 60 ? '#fef9c3' : '#fee2e2', color: c.attendanceRate >= 80 ? '#15803d' : c.attendanceRate >= 60 ? '#854d0e' : '#b91c1c', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>{c.attendanceRate}%</span>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>{Math.floor(c.totalMinutes / 60)}h {c.totalMinutes % 60}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
