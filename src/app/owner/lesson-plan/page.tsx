'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Plan {
  id: string
  lesson_type: string
  unit_minutes: number
  total_count: number
  completed_count: number
  payment_status: 'unpaid' | 'paid'
  amount: number
  member: { id: string; name: string; phone: string }
  coach:  { id: string; name: string }
  month:  { id: string; year: number; month: number }
}
interface Month { id: string; year: number; month: number }
interface Coach { id: string; name: string }

export default function LessonPlansListPage() {
  const [plans,   setPlans]   = useState<Plan[]>([])
  const [months,  setMonths]  = useState<Month[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)

  const [monthId, setMonthId] = useState('')
  const [coachId, setCoachId] = useState('')
  const [payment, setPayment] = useState('')
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    fetch('/api/months').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : []
      setMonths(list)
      if (list.length > 0) setMonthId(list[0].id)
    })
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => {
    if (!monthId && months.length > 0) return
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthId, coachId, payment])

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (monthId) params.set('month_id', monthId)
    if (coachId) params.set('coach_id', coachId)
    if (payment) params.set('payment_status', payment)
    const res = await fetch(`/api/lesson-plans/list?${params}`)
    const d = await res.json()
    setPlans(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  const filtered = search
    ? plans.filter(p =>
        p.member?.name.includes(search) ||
        p.coach?.name.includes(search) ||
        p.lesson_type.includes(search)
      )
    : plans

  const fmt = (n: number) => (n || 0).toLocaleString('ko-KR')

  const selectStyle = {
    padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem',
    fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif',
    background: 'white', color: '#374151', outline: 'none',
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>레슨 플랜 목록</h1>
          <Link href="/owner/lesson-plan"
            style={{ padding: '0.5rem 1rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none', fontFamily: 'Noto Sans KR, sans-serif' }}>
            + 새 등록
          </Link>
        </div>

        {/* 필터 */}
        <div style={{ maxWidth: '900px', margin: '0.75rem auto 0', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select value={monthId} onChange={e => setMonthId(e.target.value)} style={selectStyle}>
            <option value="">전체 월</option>
            {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
          </select>
          <select value={coachId} onChange={e => setCoachId(e.target.value)} style={selectStyle}>
            <option value="">전체 코치</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
          </select>
          <select value={payment} onChange={e => setPayment(e.target.value)} style={selectStyle}>
            <option value="">전체</option>
            <option value="unpaid">미납</option>
            <option value="paid">납부</option>
          </select>
          <input
            placeholder="회원명 / 코치명 검색"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...selectStyle, flex: 1, minWidth: '140px' }}
          />
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem 1.5rem 2rem' }}>
        {/* 요약 */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[
              { label: '전체 플랜', value: filtered.length, unit: '건', color: '#374151', bg: '#f3f4f6' },
              { label: '미납', value: filtered.filter(p => p.payment_status === 'unpaid').length, unit: '건', color: '#b91c1c', bg: '#fee2e2' },
              { label: '납부', value: filtered.filter(p => p.payment_status === 'paid').length, unit: '건', color: '#15803d', bg: '#dcfce7' },
              { label: '미납 금액', value: fmt(filtered.filter(p => p.payment_status === 'unpaid').reduce((s, p) => s + (p.amount || 0), 0)), unit: '원', color: '#b91c1c', bg: '#fef2f2' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: '0.75rem', padding: '0.625rem 1rem', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}{s.unit}</div>
                <div style={{ fontSize: '0.7rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <p>등록된 레슨 플랜이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map(p => {
              const pct = p.total_count > 0 ? Math.round(p.completed_count / p.total_count * 100) : 0
              return (
                <Link key={p.id} href={`/owner/lesson-plans/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'white',
                    border: `1.5px solid ${p.payment_status === 'paid' ? '#86efac' : '#fecaca'}`,
                    borderRadius: '1rem', padding: '1rem 1.25rem', cursor: 'pointer',
                    transition: 'box-shadow .15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{p.member?.name}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                            background: p.payment_status === 'paid' ? '#dcfce7' : '#fee2e2',
                            color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                            {p.payment_status === 'paid' ? '납부' : '미납'}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                            {p.month?.year}년 {p.month?.month}월
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px' }}>
                          {p.coach?.name} 코치 · {p.lesson_type} · {p.unit_minutes}분
                        </div>
                        {/* 진도 바 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <div style={{ flex: 1, height: '6px', background: '#f3f4f6', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#3b82f6', borderRadius: '9999px' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', flexShrink: 0 }}>
                            {p.completed_count}/{p.total_count}회
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1.1rem',
                          color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                          {fmt(p.amount)}원
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>›</div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
