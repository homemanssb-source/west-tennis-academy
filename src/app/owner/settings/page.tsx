'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Month { id: string; year: number; month: number; start_date: string; end_date: string }

export default function SettingsPage() {
  const [months, setMonths]   = useState<Month[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/months')
    const data = await res.json()
    setMonths(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const getMonthRange = (y: number, m: number) => {
    const start = new Date(y, m - 1, 1)
    const end   = new Date(y, m, 0)
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    return { start_date: fmt(start), end_date: fmt(end) }
  }

  const handleAdd = async () => {
    setSaving(true)
    const { start_date, end_date } = getMonthRange(year, month)
    const res = await fetch('/api/months', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, start_date, end_date }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return alert(data.error)
    load()
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>시스템 설정</h1>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* 월 추가 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업월 등록</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>연도</label>
              <input type="number" className="input-base" value={year} onChange={e => setYear(Number(e.target.value))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>월</label>
              <select className="input-base" value={month} onChange={e => setMonth(Number(e.target.value))}>
                {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
            <button onClick={handleAdd} disabled={saving}
              style={{ padding: '0.75rem 1.25rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap' }}>
              {saving ? '추가 중' : '+ 추가'}
            </button>
          </div>
        </div>

        {/* 월 목록 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>등록된 수업월</h2>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>불러오는 중...</div>
          ) : months.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>등록된 월이 없습니다</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {months.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', background: '#f9fafb', borderRadius: '0.75rem' }}>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#16A34A', fontSize: '1rem', marginRight: '0.75rem' }}>{m.year}.{String(m.month).padStart(2,'0')}</span>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{m.start_date} ~ {m.end_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
