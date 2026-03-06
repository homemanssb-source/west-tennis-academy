'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Month { id: string; year: number; month: number }
interface Report {
  month: { year: number; month: number }
  summary: {
    totalPlans: number; paidPlans: number; unpaidPlans: number
    totalRevenue: number; unpaidAmount: number
    totalSlots: number; completedSlots: number; absentSlots: number
  }
  byCoach:  { name: string; total: number; completed: number; absent: number }[]
  byMember: { name: string; total: number; completed: number; absent: number; paid: boolean; amount: number }[]
}

export default function ReportsPage() {
  const [months,   setMonths]   = useState<Month[]>([])
  const [monthId,  setMonthId]  = useState('')
  const [report,   setReport]   = useState<Report | null>(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    fetch('/api/months').then(r => r.json()).then(d => {
      const data = Array.isArray(d) ? d : []
      setMonths(data)
      if (data.length > 0) setMonthId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!monthId) return
    setLoading(true)
    fetch(`/api/reports?month_id=${monthId}`)
      .then(r => r.json())
      .then(d => { setReport(d); setLoading(false) })
  }, [monthId])

  const fmt = (n: number) => n.toLocaleString('ko-KR')
  const pct = (a: number, b: number) => b === 0 ? 0 : Math.round(a / b * 100)

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>월별 리포트</h1>
        <select value={monthId} onChange={e => setMonthId(e.target.value)}
          style={{ marginLeft: 'auto', padding: '0.5rem 0.875rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem' }}>
          {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
        </select>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : !report ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* 요약 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.75rem' }}>
              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '1rem', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>완납 수입</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#15803d' }}>{fmt(report.summary.totalRevenue)}원</div>
                <div style={{ fontSize: '0.75rem', color: '#16A34A', marginTop: '4px' }}>{report.summary.paidPlans}건 완납</div>
              </div>
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '1rem', padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>미납 금액</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#b91c1c' }}>{fmt(report.summary.unpaidAmount)}원</div>
                <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px' }}>{report.summary.unpaidPlans}건 미납</div>
              </div>
            </div>

            {/* 수업 통계 */}
            <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업 현황</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
                {[
                  { label: '전체', value: report.summary.totalSlots,     color: '#1d4ed8', bg: '#eff6ff' },
                  { label: '완료', value: report.summary.completedSlots, color: '#15803d', bg: '#f0fdf4' },
                  { label: '결석', value: report.summary.absentSlots,    color: '#b91c1c', bg: '#fef2f2' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: '0.875rem', padding: '0.875rem', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: s.color }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* 출석률 바 */}
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>
                  <span>출석률</span>
                  <span>{pct(report.summary.completedSlots, report.summary.totalSlots)}%</span>
                </div>
                <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct(report.summary.completedSlots, report.summary.totalSlots)}%`, background: '#16A34A', borderRadius: '9999px' }}></div>
                </div>
              </div>
            </div>

            {/* 코치별 */}
            {report.byCoach.length > 0 && (
              <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>코치별 수업</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {report.byCoach.map(c => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', background: '#f9fafb', borderRadius: '0.875rem', gap: '1rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>🎾</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827', marginBottom: '4px' }}>{c.name} 코치</div>
                        <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct(c.completed, c.total)}%`, background: '#1d4ed8', borderRadius: '9999px' }}></div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#1d4ed8', fontSize: '0.95rem' }}>{c.completed}/{c.total}</div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>결석 {c.absent}회</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 회원별 */}
            {report.byMember.length > 0 && (
              <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
                <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>회원별 현황</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>회원</th>
                        <th>수업</th>
                        <th>결석</th>
                        <th>출석률</th>
                        <th>수강료</th>
                        <th>납부</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byMember.map(m => (
                        <tr key={m.name}>
                          <td style={{ fontWeight: 600 }}>{m.name}</td>
                          <td>{m.completed}/{m.total}</td>
                          <td>{m.absent}</td>
                          <td>{pct(m.completed, m.total)}%</td>
                          <td>{fmt(m.amount)}원</td>
                          <td>
                            <span style={{ background: m.paid ? '#dcfce7' : '#fee2e2', color: m.paid ? '#15803d' : '#b91c1c', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>
                              {m.paid ? '완납' : '미납'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
