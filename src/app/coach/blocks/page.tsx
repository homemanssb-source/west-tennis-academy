'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Block {
  id: string
  block_date: string
  block_start: string | null
  block_end: string | null
  reason: string | null
}

export default function CoachBlocksPage() {
  const [blocks,  setBlocks]  = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({ block_date: '', block_start: '', block_end: '', reason: '' })

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/coach-blocks')
    const data = await res.json()
    setBlocks(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.block_date) return alert('날짜를 선택해주세요')
    setSaving(true)
    const res = await fetch('/api/coach-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); return alert(d.error) }
    setShowAdd(false)
    setForm({ block_date: '', block_start: '', block_end: '', reason: '' })
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await fetch(`/api/coach-blocks/${id}`, { method: 'DELETE' })
    load()
  }

  const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/coach" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>휴무 관리</h1>
        <button onClick={() => setShowAdd(true)} style={{ marginLeft: 'auto', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 0.875rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          + 추가
        </button>
      </div>

      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem' }}>
        <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '0.875rem', padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#1d4ed8' }}>
          💡 휴무일 또는 특정 시간대를 등록하면 해당 시간에 수업이 배정되지 않습니다
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : blocks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
            <p style={{ fontSize: '0.875rem' }}>등록된 휴무가 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {blocks.map(b => (
              <div key={b.id} style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{fmtDate(b.block_date)}</div>
                  {(b.block_start || b.block_end) && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                      {b.block_start ?? '00:00'} ~ {b.block_end ?? '23:59'}
                    </div>
                  )}
                  {!b.block_start && !b.block_end && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>종일 휴무</div>
                  )}
                  {b.reason && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>📝 {b.reason}</div>}
                </div>
                <button onClick={() => handleDelete(b.id)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bottom-nav">
        <Link href="/coach" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>🏠</span><span>홈</span></Link>
        <Link href="/coach/schedule" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>📅</span><span>스케줄</span></Link>
        <Link href="/coach/blocks" className="bottom-nav-item active"><span style={{ fontSize: '1.25rem' }}>🚫</span><span>휴무</span></Link>
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '390px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>휴무 등록</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>날짜 *</label>
                <input type="date" className="input-base" value={form.block_date} onChange={e => setForm(f => ({ ...f, block_date: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>시작 시간</label>
                  <input type="time" className="input-base" value={form.block_start} onChange={e => setForm(f => ({ ...f, block_start: e.target.value }))} placeholder="종일" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>종료 시간</label>
                  <input type="time" className="input-base" value={form.block_end} onChange={e => setForm(f => ({ ...f, block_end: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>사유</label>
                <input className="input-base" placeholder="개인 사정, 연수 등" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
              <button onClick={handleAdd} disabled={saving} style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#1d4ed8', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
