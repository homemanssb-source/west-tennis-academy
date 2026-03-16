===== app\admin\members\[id]\page.tsx =====
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Member { id: string; name: string; phone: string; is_active: boolean; pin_must_change: boolean; created_at: string }

export default function AdminMemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [member, setMember] = useState<Member | null>(null)
  const [name, setName]     = useState('')
  const [phone, setPhone]   = useState('')
  const [saving, setSaving] = useState(false)
  const [tempPin, setTempPin] = useState('')

  const load = async () => {
    const res = await fetch(`/api/members/${id}`)
    const data = await res.json()
    setMember(data); setName(data.name); setPhone(data.phone)
  }

  useEffect(() => { load() }, [id])

  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/members/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone }) })
    setSaving(false); alert('저장되었습니다'); load()
  }

  const handleResetPin = async () => {
    if (!confirm('PIN을 초기화할까요? 새 임시 PIN이 자동 발급됩니다.')) return
    const res = await fetch(`/api/members/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset_pin' }) })
    const data = await res.json()
    if (data.temp_pin) setTempPin(data.temp_pin)
  }

  const handleToggle = async () => {
    if (!confirm(member?.is_active ? '비활성화할까요?' : '활성화할까요?')) return
    await fetch(`/api/members/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle_active' }) })
    load()
  }

  if (!member) return <div style={{ padding: '4rem', textAlign: 'center', color: '#9ca3af' }}>불러오는 중...</div>

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/admin/members" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>회원 상세</h1>
        <span style={{ marginLeft: 'auto', background: member.is_active ? '#dcfce7' : '#fee2e2', color: member.is_active ? '#15803d' : '#b91c1c', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px' }}>{member.is_active ? '활성' : '비활성'}</span>
      </div>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>기본 정보</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div><label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>이름</label><input className="input-base" value={name} onChange={e => setName(e.target.value)} /></div>
            <div><label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>전화번호</label><input className="input-base" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#15803d', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>{saving ? '저장 중...' : '저장'}</button>
        </div>
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>계정 관리</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={handleResetPin} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', textAlign: 'left' }}>🔑 PIN 초기화</button>
            <button onClick={handleToggle} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${member.is_active ? '#fecaca' : '#86efac'}`, background: member.is_active ? '#fef2f2' : '#f0fdf4', color: member.is_active ? '#b91c1c' : '#15803d', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', textAlign: 'left' }}>{member.is_active ? '🚫 계정 비활성화' : '✅ 계정 활성화'}</button>
          </div>
        </div>
      </div>
      {tempPin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', maxWidth: '320px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔑</div>
            <h3 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>PIN 초기화 완료</h3>
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '1rem', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>임시 PIN</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2rem', fontWeight: 700, color: '#16A34A', letterSpacing: '6px' }}>{tempPin}</div>
            </div>
            <button onClick={() => setTempPin('')} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>확인</button>
          </div>
        </div>
      )}
    </div>
  )
}