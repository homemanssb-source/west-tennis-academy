'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface LessonPlan {
  id: string
  payment_status: 'unpaid' | 'paid'
  amount: number
  lesson_type: string
  total_count: number
  completed_count: number
  member: { id: string; name: string; phone: string }
  coach:  { id: string; name: string }
  month:  { id: string; year: number; month: number }
}

export default function PaymentPage() {
  const [plans, setPlans]       = useState<LessonPlan[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'all'|'unpaid'|'paid'>('all')
  const [selected, setSelected] = useState<LessonPlan | null>(null)
  const [saving, setSaving]     = useState(false)
  const [editAmount, setEditAmount] = useState('')

  const load = async (f: string) => {
    setLoading(true)
    const url = f === 'all' ? '/api/payment' : `/api/payment?status=${f}`
    const res = await fetch(url)
    const data = await res.json()
    setPlans(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load(filter) }, [filter])

  const handleToggle = async (plan: LessonPlan) => {
    setSaving(true)
    const newStatus = plan.payment_status === 'unpaid' ? 'paid' : 'unpaid'
    await fetch(`/api/payment/${plan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: newStatus }),
    })
    setSaving(false)
    setSelected(null)
    load(filter)
  }

  const handleSaveAmount = async () => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/payment/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(editAmount) }),
    })
    setSaving(false)
    setSelected(null)
    load(filter)
  }

  const totalUnpaid = plans.filter(p => p.payment_status === 'unpaid').reduce((s, p) => s + (p.amount || 0), 0)
  const totalPaid   = plans.filter(p => p.payment_status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)

  const fmt = (n: number) => n.toLocaleString('ko-KR')

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>납부 관리</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          {(['all','unpaid','paid'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '0.375rem 0.875rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                background: filter === f ? '#16A34A' : '#f3f4f6',
                color: filter === f ? 'white' : '#6b7280' }}>
              {f === 'all' ? '전체' : f === 'unpaid' ? '미납' : '완납'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        {/* 요약 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>미납 합계</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#b91c1c' }}>{fmt(totalUnpaid)}원</div>
          </div>
          <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>완납 합계</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>{fmt(totalPaid)}원</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
            <p>납부 내역이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {plans.map(p => (
              <div key={p.id} onClick={() => { setSelected(p); setEditAmount(String(p.amount || '')) }}
                style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{p.member?.name}</span>
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{p.month?.year}년 {p.month?.month}월</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{p.lesson_type} · {p.coach?.name} 코치 · {p.completed_count}/{p.total_count}회</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                    {fmt(p.amount || 0)}원
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                    background: p.payment_status === 'paid' ? '#dcfce7' : '#fee2e2',
                    color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                    {p.payment_status === 'paid' ? '완납' : '미납'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>납부 상세</h2>

            {[
              { label: '회원',    value: selected.member?.name },
              { label: '코치',    value: `${selected.coach?.name} 코치` },
              { label: '수업월',  value: `${selected.month?.year}년 ${selected.month?.month}월` },
              { label: '레슨종류', value: selected.lesson_type },
              { label: '수업횟수', value: `${selected.completed_count}/${selected.total_count}회` },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #f9fafb' }}>
                <span style={{ width: '70px', flexShrink: 0, fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>{row.label}</span>
                <span style={{ fontSize: '0.875rem', color: '#111827' }}>{row.value}</span>
              </div>
            ))}

            <div style={{ marginTop: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수강료 (원)</label>
              <input className="input-base" type="number" value={editAmount}
                onChange={e => setEditAmount(e.target.value)} placeholder="0" />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button onClick={handleSaveAmount} disabled={saving}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                금액 저장
              </button>
              <button onClick={() => handleToggle(selected)} disabled={saving}
                style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                  background: selected.payment_status === 'unpaid' ? '#16A34A' : '#ef4444',
                  color: 'white' }}>
                {saving ? '처리 중...' : selected.payment_status === 'unpaid' ? '✅ 완납 처리' : '↩ 미납으로 변경'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
