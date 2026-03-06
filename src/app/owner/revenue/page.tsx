'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface MonthData { month: number; paid: number; unpaid: number; total: number }
interface RevenueData { year: number; monthly: MonthData[]; totalPaid: number; totalUnpaid: number }

export default function RevenuePage() {
  const curYear = new Date().getFullYear()
  const [year, setYear] = useState(curYear)
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/revenue?year=' + year).then(r => r.json()).then(d => { setData(d); setLoading(false) })
  }, [year])

  const fmt = (n: number) => n?.toLocaleString('ko-KR')
  const maxVal = data?.monthly?.length ? Math.max(...data.monthly.map(m => m.total), 1) : 1
  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>연간 매출 분석</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => setYear(y => y - 1)} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', background: 'white', cursor: 'pointer' }}>‹</button>
          <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, minWidth: '60px', textAlign: 'center' }}>{year}년</span>
          <button onClick={() => setYear(y => y + 1)} disabled={year >= curYear} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', background: 'white', cursor: 'pointer' }}>›</button>
        </div>
      </div>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        {loading ? <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div> : !data ? null : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { label: '연간 총액', value: data.totalPaid + data.totalUnpaid, color: '#111827', bg: '#f9fafb', border: '#e5e7eb' },
                { label: '완납',     value: data.totalPaid,                    color: '#15803d', bg: '#f0fdf4', border: '#86efac' },
                { label: '미납',     value: data.totalUnpaid,                  color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: '1.5px solid ' + s.border, borderRadius: '1rem', padding: '1.25rem', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{fmt(s.value)}</div>
                  <div style={{ fontSize: '0.7rem', color: s.color, fontWeight: 600, marginTop: '4px' }}>원 · {s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1rem' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem' }}>월별 수강료 현황</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '200px' }}>
                {MONTHS.map((label, i) => {
                  const m = data.monthly.find(x => x.month === i + 1)
                  const paid = m?.paid ?? 0; const unpaid = m?.unpaid ?? 0; const total = paid + unpaid
                  const pH = total > 0 ? Math.round(paid / maxVal * 160) : 0
                  const uH = total > 0 ? Math.round(unpaid / maxVal * 160) : 0
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '200px', gap: '4px' }}>
                      {total > 0 && <div style={{ fontSize: '0.5rem', color: '#6b7280', fontWeight: 700 }}>{Math.round(total/10000)}만</div>}
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', borderRadius: '4px 4px 0 0', overflow: 'hidden' }}>
                        {uH > 0 && <div style={{ width: '100%', height: uH + 'px', background: '#fca5a5' }}></div>}
                        {pH > 0 && <div style={{ width: '100%', height: pH + 'px', background: '#16A34A' }}></div>}
                        {total === 0 && <div style={{ width: '100%', height: '4px', background: '#f3f4f6', borderRadius: '4px' }}></div>}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#9ca3af', fontWeight: 600 }}>{label}</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#6b7280' }}><div style={{ width: '12px', height: '12px', background: '#16A34A', borderRadius: '2px' }}></div>완납</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#6b7280' }}><div style={{ width: '12px', height: '12px', background: '#fca5a5', borderRadius: '2px' }}></div>미납</div>
              </div>
            </div>
            <div style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead><tr style={{ background: '#f9fafb' }}>
                  {['월','완납','미납','합계','완납률'].map(h => <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#6b7280', fontSize: '0.8rem' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {MONTHS.map((label, i) => {
                    const m = data.monthly.find(x => x.month === i + 1)
                    const paid = m?.paid ?? 0; const unpaid = m?.unpaid ?? 0; const total = paid + unpaid
                    const rate = total > 0 ? Math.round(paid / total * 100) : 0
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{label}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: paid > 0 ? '#15803d' : '#d1d5db' }}>{paid > 0 ? fmt(paid) + '원' : '-'}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: unpaid > 0 ? '#b91c1c' : '#d1d5db' }}>{unpaid > 0 ? fmt(unpaid) + '원' : '-'}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>{total > 0 ? fmt(total) + '원' : '-'}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{total > 0 ? <span style={{ background: rate===100?'#dcfce7':rate>=50?'#fef9c3':'#fee2e2', color: rate===100?'#15803d':rate>=50?'#854d0e':'#b91c1c', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>{rate}%</span> : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}