import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Coach {
  id: string
  name: string
  phone: string
  is_active: boolean
  created_at: string
}

export default function CoachesPage() {
  const [coaches, setCoaches]   = useState<Coach[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [form, setForm]         = useState({ name: '', phone: '' })
  const [saving, setSaving]     = useState(false)
  const [tempPin, setTempPin]   = useState('')
  const [selected, setSelected] = useState<Coach | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/coaches')
    const data = await res.json()
    setCoaches(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.name || !form.phone) return alert('이름과 전화번호를 입력해주세요')
    setSaving(true)
    const res = await fetch('/api/coaches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return alert(data.error)
    setTempPin(data.temp_pin)
    setForm({ name: '', phone: '' })
    load()
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/coaches/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, phone: editPhone }),
    })
    setSaving(false)
    setSelected(null)
    load()
  }

  const handleResetPin = async (id: string) => {
    if (!confirm('PIN을 초기화할까요? 새 임시 PIN이 자동 발급됩니다.')) return
    const res = await fetch(`/api/coaches/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_pin' }),
    })
    const data = await res.json()
    if (data.temp_pin) setTempPin(data.temp_pin)
  }

  const handleToggle = async (id: string) => {
    await fetch(`/api/coaches/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_active' }),
    })
    load()
  }

  const handlePhone = (v: string, setter: (s: string) => void) => {
    const num = v.replace(/\D/g,'').slice(0,11)
    const fmt = num.length <= 3 ? num : num.length <= 7 ? `${num.slice(0,3)}-${num.slice(3)}` : `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`
    setter(fmt)
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>코치 관리</h1>
        <button onClick={() => setShowAdd(true)} style={{ marginLeft: 'auto', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          + 코치 추가
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : coaches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎾</div>
            <p>등록된 코치가 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {coaches.map(c => (
              <div key={c.id} style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>🎾</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{c.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>{c.phone}</div>
                </div>
                <span style={{ background: c.is_active ? '#dcfce7' : '#fee2e2', color: c.is_active ? '#15803d' : '#b91c1c', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>
                  {c.is_active ? '활성' : '비활성'}
                </span>
                <button onClick={() => { setSelected(c); setEditName(c.name); setEditPhone(c.phone) }}
                  style={{ color: '#16A34A', fontWeight: 700, fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>수정 ›</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 코치 추가 모달 */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>코치 등록</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>이름</label>
                <input className="input-base" placeholder="홍길동" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>전화번호</label>
                <input className="input-base" placeholder="010-0000-0000" value={form.phone} onChange={e => handlePhone(e.target.value, v => setForm(f => ({ ...f, phone: v })))} inputMode="numeric" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
              <button onClick={handleAdd} disabled={saving} style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#1d4ed8', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '등록 중...' : '등록 (임시 PIN 자동 발급)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 코치 수정 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>{selected.name} 수정</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>이름</label>
                <input className="input-base" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>전화번호</label>
                <input className="input-base" value={editPhone} onChange={e => handlePhone(e.target.value, setEditPhone)} inputMode="numeric" />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <button onClick={handleSave} disabled={saving} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#1d4ed8', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => handleResetPin(selected.id)} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                🔑 PIN 초기화
              </button>
              <button onClick={() => { handleToggle(selected.id); setSelected(null) }} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${selected.is_active ? '#fecaca' : '#86efac'}`, background: selected.is_active ? '#fef2f2' : '#f0fdf4', color: selected.is_active ? '#b91c1c' : '#15803d', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {selected.is_active ? '🚫 비활성화' : '✅ 활성화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 임시 PIN 모달 */}
      {tempPin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', maxWidth: '320px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h3 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>완료!</h3>
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '1rem', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>임시 PIN</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2rem', fontWeight: 700, color: '#16A34A', letterSpacing: '6px' }}>{tempPin}</div>
            </div>
            <button onClick={() => { setTempPin(''); setShowAdd(false) }}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}