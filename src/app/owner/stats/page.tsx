'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Month { id: string; year: number; month: number }
interface CoachStat {
  id: string; name: string
  planCount: number; totalCount: number; completedCount: number
  paidAmount: number; unpaidAmount: number
}
interface Stats {
  totalPaid: number; totalUnpaid: number
  totalSlots: number; doneSlots: number; planCount: number
  coachStats: CoachStat[]
}

export default function StatsPage() {
  const [months,   setMonths]   = useState<Month[]>([])
  const [monthId,  setMonthId]  = useState('')
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    fetch('/api/months').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : []
      setMonths(list)
      if (list.length > 0) setMonthId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!monthId) return
    setLoading(true)
    fetch(`/api/stats/monthly?month_id=${monthId}`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
  }, [monthId])

  const fmt = (n: number) => (n || 0).toLocaleString('ko-KR')
  const selectedMonth = months.find(m => m.id === monthId)

  const cardStyle = (color: string) => ({
    background: 'white', borderRadius: '1rem', border: `1.5px solid ${color}`,
    padding: '1.25rem', flex: 1,
  })

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>월별 통계</h1>
          <select
            value={monthId}
            onChange={e => setMonthId(e.target.value)}
            style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', background: 'white' }}
          >
            {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : !stats ? null : (
          <>
            {/* 월 타이틀 */}
            {selectedMonth && (
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
                {selectedMonth.year}년 {selectedMonth.month}월
              </div>
            )}

            {/* 요약 카드 */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={cardStyle('#86efac')}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>납부 완료</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#15803d' }}>{fmt(stats.totalPaid)}원</div>
              </div>
              <div style={cardStyle('#fca5a5')}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>미납 합계</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#b91c1c' }}>{fmt(stats.totalUnpaid)}원</div>
              </div>
              <div style={cardStyle('#bfdbfe')}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '4px' }}>총 수업</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#1d4ed8' }}>{stats.doneSlots} / {stats.totalSlots}회</div>
              </div>
              <div style={cardStyle('#e9d5ff')}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', marginBottom: '4px' }}>등록 플랜</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#7c3aed' }}>{stats.planCount}건</div>
              </div>
            </div>

            {/* 납부율 바 */}
            <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>납부율</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803d' }}>
                  {stats.totalPaid + stats.totalUnpaid > 0
                    ? Math.round(stats.totalPaid / (stats.totalPaid + stats.totalUnpaid) * 100)
                    : 0}%
                </span>
              </div>
              <div style={{ background: '#f3f4f6', borderRadius: '9999px', height: '10px', overflow: 'hidden' }}>
                <div style={{
                  background: '#16A34A', height: '100%', borderRadius: '9999px',
                  width: `${stats.totalPaid + stats.totalUnpaid > 0 ? Math.round(stats.totalPaid / (stats.totalPaid + stats.totalUnpaid) * 100) : 0}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>납부 {fmt(stats.totalPaid)}원</span>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>미납 {fmt(stats.totalUnpaid)}원</span>
              </div>
            </div>

            {/* 코치별 통계 */}
            <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>코치별 통계</h2>
              {stats.coachStats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: '0.875rem' }}>데이터 없음</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {stats.coachStats.map(c => (
                    <div key={c.id} style={{ background: '#f9fafb', borderRadius: '0.875rem', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.625rem' }}>
                        <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>{c.name} 코치</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#6b7280' }}>플랜 {c.planCount}건</span>
                      </div>
                      {/* 수업 완료 바 */}
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>수업 완료율</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#374151' }}>
                            {c.completedCount}/{c.totalCount}회 ({c.totalCount > 0 ? Math.round(c.completedCount / c.totalCount * 100) : 0}%)
                          </span>
                        </div>
                        <div style={{ background: '#e5e7eb', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                          <div style={{
                            background: '#3b82f6', height: '100%', borderRadius: '9999px',
                            width: `${c.totalCount > 0 ? Math.round(c.completedCount / c.totalCount * 100) : 0}%`,
                          }} />
                        </div>
                      </div>
                      {/* 납부 현황 */}
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ flex: 1, background: '#dcfce7', borderRadius: '0.5rem', padding: '0.375rem 0.625rem' }}>
                          <div style={{ fontSize: '0.65rem', color: '#15803d', fontWeight: 700 }}>납부</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803d', fontFamily: 'Oswald, sans-serif' }}>{fmt(c.paidAmount)}원</div>
                        </div>
                        <div style={{ flex: 1, background: '#fee2e2', borderRadius: '0.5rem', padding: '0.375rem 0.625rem' }}>
                          <div style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: 700 }}>미납</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#b91c1c', fontFamily: 'Oswald, sans-serif' }}>{fmt(c.unpaidAmount)}원</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
