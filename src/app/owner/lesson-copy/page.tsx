'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Month { id: string; year: number; month: number }

export default function LessonCopyPage() {
  const [months,      setMonths]      = useState<Month[]>([])
  const [coaches,     setCoaches]     = useState<any[]>([])
  const [fromMonthId, setFromMonthId] = useState('')
  const [toMonthId,   setToMonthId]   = useState('')
  const [coachId,     setCoachId]     = useState('')
  const [result,      setResult]      = useState<any>(null)
  const [copying,     setCopying]     = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    fetch('/api/months').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d.sort((a: Month, b: Month) => b.year !== a.year ? b.year - a.year : b.month - a.month) : []
      setMonths(list)
      if (list.length > 0) setFromMonthId(list[0].id)
      if (list.length > 1) setToMonthId(list[1].id)
    })
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
  }, [])

  const handleCopy = async () => {
    if (!fromMonthId || !toMonthId) return setError('원본과 대상 월을 선택해주세요')
    if (fromMonthId === toMonthId) return setError('원본과 대상 월이 같습니다')
    setError('')
    setResult(null)
    setCopying(true)
    const res = await fetch('/api/lesson-plans/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_month_id: fromMonthId, to_month_id: toMonthId, coach_id: coachId || undefined }),
    })
    const data = await res.json()
    setCopying(false)
    if (!res.ok) return setError(data.error)
    setResult(data)
  }

  const fmtMonth = (m: Month) => `${m.year}년 ${m.month}월`

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>레슨 플랜 복사</h1>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '1rem', padding: '1rem', fontSize: '0.875rem', color: '#1d4ed8' }}>
          💡 이전 달의 레슨 플랜(수업 일정 제외)을 다음 달로 복사합니다. 슬롯은 복사되지 않으며 납부 상태는 미납으로 초기화됩니다.
        </div>

        <div style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* 원본 월 */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '8px' }}>📋 복사할 원본 월</label>
            <select value={fromMonthId} onChange={e => setFromMonthId(e.target.value)} className="input-base">
              <option value="">선택</option>
              {months.map(m => <option key={m.id} value={m.id}>{fmtMonth(m)}</option>)}
            </select>
          </div>

          {/* 화살표 */}
          <div style={{ textAlign: 'center', fontSize: '1.5rem', color: '#9ca3af' }}>⬇️</div>

          {/* 대상 월 */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '8px' }}>📅 붙여넣을 대상 월</label>
            <select value={toMonthId} onChange={e => setToMonthId(e.target.value)} className="input-base">
              <option value="">선택</option>
              {months.map(m => <option key={m.id} value={m.id}>{fmtMonth(m)}</option>)}
            </select>
          </div>

          {/* 코치 필터 (선택) */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '8px' }}>🎾 특정 코치만 복사 (선택사항)</label>
            <select value={coachId} onChange={e => setCoachId(e.target.value)} className="input-base">
              <option value="">전체 코치</option>
              {coaches.map((c: any) => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
            </select>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.875rem', fontSize: '0.875rem', color: '#b91c1c' }}>
              ⚠️ {error}
            </div>
          )}

          <button onClick={handleCopy} disabled={copying || !fromMonthId || !toMonthId}
            style={{ padding: '0.875rem', borderRadius: '0.875rem', border: 'none', background: (!fromMonthId || !toMonthId) ? '#f3f4f6' : '#1d4ed8', color: (!fromMonthId || !toMonthId) ? '#9ca3af' : 'white', fontWeight: 700, cursor: (!fromMonthId || !toMonthId) ? 'default' : 'pointer', fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
            {copying ? '복사 중...' : '📋 레슨 플랜 복사하기'}
          </button>
        </div>

        {result && (
          <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#15803d', marginBottom: '0.5rem' }}>복사 완료!</div>
            <div style={{ fontSize: '0.875rem', color: '#16a34a' }}>{result.message}</div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
              <div style={{ background: 'white', borderRadius: '0.75rem', padding: '0.625rem 1rem', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>{result.copied}</div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>복사됨</div>
              </div>
              {result.skipped > 0 && (
                <div style={{ background: 'white', borderRadius: '0.75rem', padding: '0.625rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#9ca3af' }}>{result.skipped}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>중복 건너뜀</div>
                </div>
              )}
            </div>
            <Link href="/owner/lesson-plan" style={{ display: 'block', marginTop: '1rem', color: '#1d4ed8', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
              → 레슨 플랜 등록 페이지로 이동
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
