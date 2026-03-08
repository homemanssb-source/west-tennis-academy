'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Block {
  id: string
  block_date: string | null
  block_start: string | null
  block_end: string | null
  reason: string | null
  repeat_weekly: boolean
  day_of_week: number | null
}

const DAYS = ['일','월','화','수','목','금','토']
const TIMES = Array.from({length: 29}, (_, i) => {
  const h = Math.floor(i/2) + 7
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2,'0')}:${m}`
})

export default function CoachHolidaysPage() {
  const [blocks,  setBlocks]  = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [mode,       setMode]       = useState<'weekly'|'date'>('weekly')
  const [dayOfWeek,  setDayOfWeek]  = useState(1)
  const [blockDate,  setBlockDate]  = useState('')
  const [blockStart, setBlockStart] = useState('09:00')
  const [blockEnd,   setBlockEnd]   = useState('18:00')
  const [reason,     setReason]     = useState('')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/coach-blocks')
    const d = await res.json()
    setBlocks(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setSaving(true)
    const body = mode === 'weekly'
      ? { repeat_weekly: true, day_of_week: dayOfWeek, block_start: blockStart, block_end: blockEnd, reason }
      : { repeat_weekly: false, block_date: blockDate, block_start: blockStart, block_end: blockEnd, reason }

    const res = await fetch('/api/coach-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json()
    setSaving(false)
    if (d.error) { alert('저장 실패: ' + d.error); return }
    setShowForm(false)
    setReason('')
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch('/api/coach-blocks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const weekly = blocks.filter(b => b.repeat_weekly)
  const single = blocks.filter(b => !b.repeat_weekly)

  const s = {
    input: { width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', background: 'white', boxSizing: 'border-box' as const, outline: 'none', color: '#111827' },
    label: { fontSize: '0.75rem', fontWeight: 700 as const, color: '#6b7280', display: 'block' as const, marginBottom: '6px' },
    btn:   { padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer' as const, fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif' },
    btnOn: { padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #16A34A', background: '#f0fdf4', color: '#15803d', cursor: 'pointer' as const, fontSize: '0.8rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' },
  }

  return (
    <div className="mobile-wrap" style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/coach" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827', flex: 1 }}>휴무 관리</h1>
          <button onClick={() => setShowForm(true)}
            style={{ padding: '0.5rem 1rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            + 추가
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem', paddingBottom: '6rem' }}>

        {/* 매주 반복 휴무 */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.5rem' }}>🔁 매주 반복 휴무</div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>불러오는 중..</div>
          ) : weekly.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', fontSize: '0.85rem' }}>
              등록된 반복 휴무가 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {weekly.map(b => (
                <div key={b.id} style={{ background: 'white', border: '1.5px solid #fde68a', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                      매주 {DAYS[b.day_of_week!]}요일
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      {b.block_start ?? '종일'}{b.block_end ? ` ~ ${b.block_end}` : ''}
                      {b.reason && ` · ${b.reason}`}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(b.id)}
                    style={{ padding: '0.375rem 0.75rem', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 특정 날짜 휴무 */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.5rem' }}>📅 특정 날짜 휴무</div>
          {!loading && single.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', fontSize: '0.85rem' }}>
              등록된 날짜 휴무가 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {single.map(b => (
                <div key={b.id} style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                      {b.block_date}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      {b.block_start ?? '종일'}{b.block_end ? ` ~ ${b.block_end}` : ''}
                      {b.reason && ` · ${b.reason}`}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(b.id)}
                    style={{ padding: '0.375rem 0.75rem', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 추가 모달 */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '390px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', paddingBottom: '5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>휴무 추가</h2>

            {/* 모드 선택 */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button onClick={() => setMode('weekly')} style={{ ...(mode === 'weekly' ? s.btnOn : s.btn), flex: 1 }}>🔁 매주 반복</button>
              <button onClick={() => setMode('date')}   style={{ ...(mode === 'date'   ? s.btnOn : s.btn), flex: 1 }}>📅 특정 날짜</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {mode === 'weekly' ? (
                <div>
                  <label style={s.label}>휴무 요일</label>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {DAYS.map((d, i) => (
                      <button key={i} onClick={() => setDayOfWeek(i)}
                        style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.625rem', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: dayOfWeek === i ? '#16A34A' : '#f3f4f6', color: dayOfWeek === i ? 'white' : '#6b7280' }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label style={s.label}>날짜</label>
                  <input type="date" style={s.input} value={blockDate} onChange={e => setBlockDate(e.target.value)} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>시작 시간</label>
                  <select style={s.input} value={blockStart} onChange={e => setBlockStart(e.target.value)}>
                    <option value="">종일</option>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>종료 시간</label>
                  <select style={s.input} value={blockEnd} onChange={e => setBlockEnd(e.target.value)}>
                    <option value="">종일</option>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={s.label}>사유 (선택)</label>
                <input style={s.input} value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 개인 사정, 연수 등" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1.25rem' }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: '0.875rem', background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                취소
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, padding: '0.875rem', background: saving ? '#e5e7eb' : '#16A34A', color: saving ? '#9ca3af' : 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '저장 중..' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 하단 네비 */}
      <div className="bottom-nav">
        <Link href="/coach" className="bottom-nav-item">
          <span style={{ fontSize: '1.25rem' }}>🏠</span><span>홈</span>
        </Link>
        <Link href="/coach/schedule" className="bottom-nav-item">
          <span style={{ fontSize: '1.25rem' }}>📅</span><span>스케줄</span>
        </Link>
        <Link href="/coach/applications" className="bottom-nav-item">
          <span style={{ fontSize: '1.25rem' }}>🎾</span><span>신청</span>
        </Link>
      </div>
    </div>
  )
}


