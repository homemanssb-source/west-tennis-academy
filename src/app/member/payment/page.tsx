'use client'

import { useEffect, useState } from 'react'
import MemberBottomNav from '@/components/MemberBottomNav'

interface Plan {
  id: string
  payment_status: string
  amount: number
  lesson_type: string
  total_count: number
  completed_count: number
  unit_minutes: number
  coach: { name: string }
  month: { year: number; month: number }
}

export default function MemberPaymentPage() {
  const [plans, setPlans]     = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/my-payment').then(r => r.json()).then(d => {
      setPlans(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const fmt = (n: number) => n.toLocaleString('ko-KR')

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>납부 현황</div>
      </div>

      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💰</div>
            <p style={{ fontSize: '0.875rem' }}>납부 내역이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {plans.map(p => (
              <div key={p.id} style={{ background: 'white', border: `1.5px solid ${p.payment_status === 'paid' ? '#86efac' : '#fecaca'}`, borderRadius: '1rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{p.month?.year}년 {p.month?.month}월</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>{p.lesson_type} · {p.coach?.name} 코치</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 12px', borderRadius: '9999px',
                    background: p.payment_status === 'paid' ? '#dcfce7' : '#fee2e2',
                    color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                    {p.payment_status === 'paid' ? '완납' : '미납'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={{ background: '#f9fafb', borderRadius: '0.625rem', padding: '0.625rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '2px' }}>수강료</div>
                    <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>{fmt(p.amount)}원</div>
                  </div>
                  <div style={{ background: '#f9fafb', borderRadius: '0.625rem', padding: '0.625rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '2px' }}>수업 진행</div>
                    <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>{p.completed_count}/{p.total_count}회</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MemberBottomNav />
    </div>
  )
}