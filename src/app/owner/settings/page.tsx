'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Month  { id: string; year: number; month: number; start_date: string; end_date: string }
interface Staff  { id: string; name: string; phone: string; role: string; is_active: boolean; created_at: string }

const ROLE_LABEL: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  admin:   { label: '관리자',   emoji: '🛡️', color: '#15803d', bg: '#dcfce7' },
  coach:   { label: '코치',     emoji: '🎾', color: '#1d4ed8', bg: '#dbeafe' },
  payment: { label: '결제담당', emoji: '💳', color: '#92400e', bg: '#fde68a' },
}

export default function SettingsPage() {
  const [months, setMonths]     = useState<Month[]>([])
  const [staff,  setStaff]      = useState<Staff[]>([])
  const [loadingM, setLoadingM] = useState(true)
  const [loadingS, setLoadingS] = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [tempPin,  setTempPin]  = useState('')
  const [selected, setSelected] = useState<Staff | null>(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone,setEditPhone]= useState('')
  const [form, setForm]         = useState({ name: '', phone: '', role: 'admin' })

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const loadMonths = async () => {
    setLoadingM(true)
    const res = await fetch('/api/months')
    const data = await res.json()
    setMonths(Array.isArray(data) ? data : [])
    setLoadingM(false)
  }

  const loadStaff = async () => {
    setLoadingS(true)
    const res = await fetch('/api/staff')
    const data = await res.json()
    setStaff(Array.isArray(data) ? data : [])
    setLoadingS(false)
  }

  useEffect(() => { loadMonths(); loadStaff() }, [])

  const getMonthRange = (y: number, m: number) => {
    const start = new Date(y, m - 1, 1)
    const end   = new Date(y, m, 0)
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    return { start_date: fmt(start), end_date: fmt(end) }
  }

  const handleAddMonth = async () => {
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
    loadMonths()
  }

  const handleAddStaff = async () => {
    if (!form.name || !form.phone) return alert('이름과 전화번호를 입력해주세요')
    setSaving(true)
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return alert(data.error)
    setTempPin(data.temp_pin)
    setForm({ name: '', phone: '', role: 'admin' })
    loadStaff()
  }

  const handleSaveStaff = async () => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/staff/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, phone: editPhone }),
    })
    setSaving(false)
    setSelected(null)
    loadStaff()
  }

  const handleResetPin = async (id: string) => {
    if (!confirm('PIN을 초기화할까요? 새 임시 PIN이 자동 발급됩니다.')) return
    const res = await fetch(`/api/staff/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_pin' }),
    })
    const data = await res.json()
    if (data.temp_pin) setTempPin(data.temp_pin)
  }

  const handleToggle = async (id: string) => {
    await fetch(`/api/staff/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_active' }),
    })
    loadStaff()
    setSelected(null)
  }

  const handlePhone = (v: string, setter: (s: string) => void) => {
    const num = v.replace(/\D/g,'').slice(0,11)
    const fmt = num.length <= 3 ? num : num.length <= 7 ? `${num.slice(0,3)}-${num.slice(3)}` : `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`
    setter(fmt)
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>시스템 설정</h1>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* 스탭 관리 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>스탭 관리</h2>
            <button onClick={() => setShowAdd(true)} style={{ background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.375rem 0.875rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              + 추가
            </button>
          </div>

          {loadingS ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>불러오는 중...</div>
          : staff.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>등록된 스탭이 없습니다</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {staff.map(s => {
                const r = ROLE_LABEL[s.role] ?? { label: s.role, emoji: '👤', color: '#6b7280', bg: '#f3f4f6' }
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', background: '#f9fafb', borderRadius: '0.875rem', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{r.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.phone}</div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: r.bg, color: r.color }}>{r.label}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: s.is_active ? '#dcfce7' : '#fee2e2', color: s.is_active ? '#15803d' : '#b91c1c' }}>{s.is_active ? '활성' : '비활성'}</span>
                    <button onClick={() => { setSelected(s); setEditName(s.name); setEditPhone(s.phone) }}
                      style={{ color: '#16A34A', fontWeight: 700, fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>수정</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 수업월 등록 */}
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
            <button onClick={handleAddMonth} disabled={saving}
              style={{ padding: '0.75rem 1.25rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap' }}>
              {saving ? '추가 중' : '+ 추가'}
            </button>
          </div>
        </div>

        {/* 월 목록 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>등록된 수업월</h2>
          {loadingM ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>불러오는 중...</div>
          : months.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>등록된 월이 없습니다</div>
          : (
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

      {/* 스탭 추가 모달 */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>스탭 등록</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>역할</label>
                <select className="input-base" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="admin">🛡️ 관리자</option>
                  <option value="coach">🎾 코치</option>
                  <option value="payment">💳 결제담당</option>
                </select>
              </div>
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
              <button onClick={handleAddStaff} disabled={saving} style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '등록 중...' : '등록 (임시 PIN 자동 발급)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스탭 수정 모달 */}
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
              <button onClick={handleSaveStaff} disabled={saving} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => handleResetPin(selected.id)} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                🔑 PIN 초기화 (임시 PIN 자동 발급)
              </button>
              <button onClick={() => handleToggle(selected.id)} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${selected.is_active ? '#fecaca' : '#86efac'}`, background: selected.is_active ? '#fef2f2' : '#f0fdf4', color: selected.is_active ? '#b91c1c' : '#15803d', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {selected.is_active ? '🚫 비활성화' : '✅ 활성화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN 완료 모달 */}
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