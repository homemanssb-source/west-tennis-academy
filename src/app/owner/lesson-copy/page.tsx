'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Month { id: string; year: number; month: number }

export default function LessonCopyPage() {
  const router = useRouter()
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
      const list = Array.isArray(d)
        ? d.sort((a: Month, b: Month) => b.year !== a.year ? b.year - a.year : b.month - a.month)
        : []
      setMonths(list)

      // 기본값: 이번 달 → 다음 달 자동 선택
      const now   = new Date()
      const cy    = now.getFullYear()
      const cm    = now.getMonth() + 1
      const ny    = cm === 12 ? cy + 1 : cy
      const nm    = cm === 12 ? 1 : cm + 1

      const thisRec = list.find((m: Month) => m.year === cy && m.month === cm)
      const nextRec = list.find((m: Month) => m.year === ny && m.month === nm)

      if (thisRec) setFromMonthId(thisRec.id)
      if (nextRec) setToMonthId(nextRec.id)
      else if (list.length > 1) setToMonthId(list[1].id)
    })
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
  }, [])

  const handleCopy = async () => {
    if (!fromMonthId || !toMonthId) return setError('원본과 대상 월을 선택해주세요')
    if (fromMonthId === toMonthId)  return setError('원본과 대상 월이 같습니다')
    setError('')
    setResult(null)
    setCopying(true)
    const res  = await fetch('/api/lesson-plans/copy', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from_month_id: fromMonthId, to_month_id: toMonthId, coach_id: coachId || undefined }),
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

        {/* 안내 배너 */}
        <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '1rem', padding: '1rem', fontSize: '0.875rem', color: '#1d4ed8' }}>
          💡 이번 달 수업 패턴을 분석해 다음 달 수업 초안을 자동 생성합니다.<br/>
          <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>
            • 코치 휴무일은 자동 제외됩니다<br/>
            • 반복 실행해도 중복이 생기지 않습니다<br/>
            • 생성 후 <strong>수업 초안 확정</strong> 메뉴에서 확인·수정하세요
          </span>
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

          <div style={{ textAlign: 'center', fontSize: '1.5rem', color: '#9ca3af' }}>⬇️</div>

          {/* 대상 월 */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '8px' }}>📅 생성할 대상 월</label>
            <select value={toMonthId} onChange={e => setToMonthId(e.target.value)} className="input-base">
              <option value="">선택</option>
              {months.map(m => <option key={m.id} value={m.id}>{fmtMonth(m)}</option>)}
            </select>
          </div>

          {/* 코치 필터 */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '8px' }}>🎾 특정 코치만 (선택사항)</label>
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

          <button
            onClick={handleCopy}
            disabled={copying || !fromMonthId || !toMonthId}
            style={{ padding: '0.875rem', borderRadius: '0.875rem', border: 'none', background: (!fromMonthId || !toMonthId) ? '#f3f4f6' : '#1d4ed8', color: (!fromMonthId || !toMonthId) ? '#9ca3af' : 'white', fontWeight: 700, cursor: (!fromMonthId || !toMonthId || copying) ? 'not-allowed' : 'pointer', fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
            {copying ? '⏳ 처리 중...' : '📋 플랜 복사 + 수업 초안 생성'}
          </button>
        </div>

        {/* 결과 */}
        {result && (
          <div style={{ background: result.conflicts > 0 ? '#fffbeb' : '#f0fdf4', border: `1.5px solid ${result.conflicts > 0 ? '#fde68a' : '#86efac'}`, borderRadius: '1rem', padding: '1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{result.conflicts > 0 ? '⚠️' : '✅'}</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: result.conflicts > 0 ? '#92400e' : '#15803d' }}>
                {result.conflicts > 0 ? '완료 (충돌 확인 필요)' : '완료!'}
              </div>
            </div>

            {/* 통계 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
              {[
                { label: '플랜 복사', value: result.copied,    color: '#1d4ed8', show: true },
                { label: '기존 유지', value: result.skipped,   color: '#6b7280', show: result.skipped > 0 },
                { label: '수업 초안', value: result.slots,     color: '#15803d', show: true },
                { label: '이미 존재', value: result.slotSkipped, color: '#9ca3af', show: result.slotSkipped > 0 },
                { label: '휴무 충돌', value: result.conflicts, color: '#b91c1c', show: result.conflicts > 0 },
              ].filter(x => x.show).map(x => (
                <div key={x.label} style={{ background: 'white', borderRadius: '0.75rem', padding: '0.625rem 0.5rem', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: x.color }}>{x.value}</div>
                  <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '2px' }}>{x.label}</div>
                </div>
              ))}
            </div>

            {/* 충돌 경고 */}
            {result.conflicts > 0 && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.75rem', fontSize: '0.8rem', color: '#b91c1c', marginBottom: '0.75rem' }}>
                ⚠️ 코치 휴무와 겹치는 수업 {result.conflicts}건이 있습니다. 초안 확인 메뉴에서 처리해주세요.
              </div>
            )}

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {result.slots > 0 && (
                <button
                  onClick={() => router.push('/owner/schedule-draft')}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: result.conflicts > 0 ? '#b91c1c' : '#15803d', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.9rem' }}>
                  {result.conflicts > 0 ? '⚠️ 수업 초안 확인 (충돌 있음)' : '✅ 수업 초안 확정하러 가기'} →
                </button>
              )}
              <button
                onClick={() => { setResult(null); setError('') }}
                style={{ width: '100%', padding: '0.625rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.85rem' }}>
                다시 복사하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}