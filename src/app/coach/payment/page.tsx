'use client'
// src/app/coach/payment/page.tsx
// ✅ fix: 자녀 이름 표시 (부모(자녀) 형태)
import { useEffect, useState } from 'react'
import Link from 'next/link'
import CoachBottomNav from '@/components/CoachBottomNav'

interface Plan {
  id: string
  lesson_type: string
  unit_minutes: number
  total_count: number
  completed_count: number
  payment_status: 'unpaid' | 'paid'
  amount: number
  family_member_name: string | null  // ✅ 추가
  member: { id: string; name: string; phone: string }
  month:  { id: string; year: number; month: number }
}
interface Month { id: string; year: number; month: number }

export default function CoachPaymentPage() {
  const [plans,   setPlans]   = useState<Plan[]>([])
  const [months,  setMonths]  = useState<Month[]>([])
  const [monthId, setMonthId] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<'all' | 'unpaid' | 'paid'>('all')

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
    fetch(`/api/coach/payment?month_id=${monthId}`)
      .then(r => r.json())
      .then(d => { setPlans(Array.isArray(d) ? d : []); setLoading(false) })
  }, [monthId])

  const fmt = (n: number) => (n || 0).toLocaleString('ko-KR')

  const filtered = plans.filter(p =>
    filter === 'all'    ? true :
    filter === 'unpaid' ? p.payment_status === 'unpaid' :
    p.payment_status === 'paid'
  )

  const totalAmount   = plans.reduce((s, p) => s + (p.amount || 0), 0)
  const paidAmount    = plans.filter(p => p.payment_status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
  const unpaidAmount  = plans.filter(p => p.payment_status === 'unpaid').reduce((s, p) => s + (p.amount || 0), 0)
  const paidCount     = plans.filter(p => p.payment_status === 'paid').length
  const unpaidCount   = plans.filter(p => p.payment_status === 'unpaid').length
  const selectedMonth = months.find(m => m.id === monthId)

  return (
    <div className="mobile-wrap" style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/coach" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.2rem', fontWeight: 700, color: '#111827', flex: 1 }}>💰 납부 현황</h1>
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <select value={monthId} onChange={e => setMonthId(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', background: 'white', color: '#374151', outline: 'none' }}>
            {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.25rem 5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {!loading && (
          <div style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)', borderRadius: '1.25rem', padding: '1.25rem', color: 'white' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.75, marginBottom: '0.25rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {selectedMonth ? `${selectedMonth.year}년 ${selectedMonth.month}월` : ''} 총 수업료
            </div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>
              {fmt(totalAmount)}<span style={{ fontSize: '1rem', fontWeight: 400, marginLeft: '4px' }}>원</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '0.875rem', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.25rem', fontFamily: 'Noto Sans KR, sans-serif' }}>✅ 납부 완료</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700 }}>{fmt(paidAmount)}원</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '2px', fontFamily: 'Noto Sans KR, sans-serif' }}>{paidCount}명</div>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.25)', borderRadius: '0.875rem', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.25rem', fontFamily: 'Noto Sans KR, sans-serif' }}>⏳ 미납</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700 }}>{fmt(unpaidAmount)}원</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '2px', fontFamily: 'Noto Sans KR, sans-serif' }}>{unpaidCount}명</div>
              </div>
            </div>
            {totalAmount > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.75, marginBottom: '0.375rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  <span>납부율</span>
                  <span>{Math.round(paidAmount / totalAmount * 100)}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ background: '#4ade80', height: '100%', borderRadius: '9999px', width: `${Math.round(paidAmount / totalAmount * 100)}%`, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', background: 'white', borderRadius: '0.875rem', border: '1.5px solid #f3f4f6', padding: '0.375rem' }}>
          {([
            { key: 'all',    label: `전체 (${plans.length})` },
            { key: 'unpaid', label: `미납 (${unpaidCount})` },
            { key: 'paid',   label: `납부 (${paidCount})` },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '0.625rem', border: 'none', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif', cursor: 'pointer',
                background: filter === tab.key ? (tab.key === 'unpaid' ? '#fef2f2' : tab.key === 'paid' ? '#f0fdf4' : '#f3f4f6') : 'transparent',
                color:      filter === tab.key ? (tab.key === 'unpaid' ? '#b91c1c' : tab.key === 'paid' ? '#16A34A' : '#374151') : '#9ca3af' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💳</div>
            <p style={{ fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>해당하는 내역이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map(p => {
              // ✅ 자녀 이름 있으면 "부모(자녀)" 형태로 표시
              const displayName = p.family_member_name
                ? `${p.member?.name}(${p.family_member_name})`
                : p.member?.name
              return (
                <div key={p.id} style={{ background: 'white', borderRadius: '1rem', border: `1.5px solid ${p.payment_status === 'unpaid' ? '#fecaca' : '#bbf7d0'}`, padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: p.payment_status === 'unpaid' ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                      {p.payment_status === 'unpaid' ? '⏳' : '✅'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827', fontFamily: 'Noto Sans KR, sans-serif' }}>
                          {displayName}
                        </span>
                        {p.family_member_name && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: '9999px' }}>자녀</span>
                        )}
                        <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontFamily: 'Noto Sans KR, sans-serif' }}>{p.lesson_type}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        {p.total_count}회 · {p.unit_minutes}분
                        <span style={{ marginLeft: '0.5rem', color: '#9ca3af' }}>{p.member?.phone}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: p.payment_status === 'unpaid' ? '#b91c1c' : '#16A34A' }}>
                        {fmt(p.amount)}원
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', marginTop: '4px', display: 'inline-block',
                        background: p.payment_status === 'unpaid' ? '#fef2f2' : '#f0fdf4',
                        color:      p.payment_status === 'unpaid' ? '#b91c1c' : '#16A34A',
                        fontFamily: 'Noto Sans KR, sans-serif' }}>
                        {p.payment_status === 'unpaid' ? '미납' : '납부'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CoachBottomNav />
    </div>
  )
}