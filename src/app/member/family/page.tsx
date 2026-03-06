'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface FamilyMember {
  id: string
  name: string
  birth_date: string | null
  notes: string | null
  is_active: boolean
}

export default function FamilyPage() {
  const [members, setMembers]   = useState<FamilyMember[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [selected, setSelected] = useState<FamilyMember | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ name: '', birth_date: '', notes: '' })

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/family')
    const data = await res.json()
    setMembers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.name) return alert('이름을 입력해주세요')
    setSaving(true)
    const res = await fetch('/api/family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return alert(data.error)
    setShowAdd(false)
    setForm({ name: '', birth_date: '', notes: '' })
    load()
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/family/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: selected.name, birth_date: selected.birth_date, notes: selected.notes, is_active: selected.is_active }),
    })
    setSaving(false)
    setSelected(null)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await fetch(`/api/family/${id}`, { method: 'DELETE' })
    setSelected(null)
    load()
  }

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/member" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>가족 구성원</h1>
        <button onClick={() => setShowAdd(true)} style={{ marginLeft: 'auto', background: '#7e22ce', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 0.875rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          + 추가
        </button>
      </div>

      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem' }}>
        <div style={{ background: '#fdf4ff', border: '1.5px solid #e9d5ff', borderRadius: '0.875rem', padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#7e22ce' }}>
          💡 가족 구성원을 등록하면 수업 예약 시 구성원을 선택할 수 있습니다
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : members.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👨‍👩‍👧‍👦</div>
            <p style={{ fontSize: '0.875rem' }}>등록된 가족 구성원이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {members.map(m => (
              <div key={m.id} onClick={() => setSelected({ ...m })}
                style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem', cursor: 'pointer' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fdf4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{m.name}</div>
                  {m.birth_date && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{m.birth_date}</div>}
                  {m.notes && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{m.notes}</div>}
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: m.is_active ? '#ede9fe' : '#fee2e2', color: m.is_active ? '#7e22ce' : '#b91c1c' }}>
                  {m.is_active ? '활성' : '비활성'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bottom-nav">
        <Link href="/member" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>🏠</span><span>홈</span></Link>
        <Link href="/member/schedule" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>📅</span><span>스케줄</span></Link>
        <Link href="/member/payment" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>💰</span><span>납부</span></Link>
        <Link href="/member/family" className="bottom-nav-item active"><span style={{ fontSize: '1.25rem' }}>👨‍👩‍👧‍👦</span><span>가족</span></Link>
      </div>

      {/* 추가 모달 */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '390px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>가족 구성원 추가</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>이름 *</label>
                <input className="input-base" placeholder="홍길동" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>생년월일</label>
                <input type="date" className="input-base" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>메모</label>
                <input className="input-base" placeholder="관계, 특이사항 등" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
              <button onClick={handleAdd} disabled={saving} style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#7e22ce', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '390px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>구성원 수정</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>이름</label>
                <input className="input-base" value={selected.name} onChange={e => setSelected(s => s ? { ...s, name: e.target.value } : s)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>생년월일</label>
                <input type="date" className="input-base" value={selected.birth_date ?? ''} onChange={e => setSelected(s => s ? { ...s, birth_date: e.target.value } : s)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>메모</label>
                <input className="input-base" value={selected.notes ?? ''} onChange={e => setSelected(s => s ? { ...s, notes: e.target.value } : s)} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '1.5rem' }}>
              <button onClick={handleSave} disabled={saving} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#7e22ce', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => handleDelete(selected.id)} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                🗑️ 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
