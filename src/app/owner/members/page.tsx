'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Member {
  id: string
  name: string
  phone: string
  is_active: boolean
  created_at: string
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm]       = useState({ name: '', phone: '' })
  const [saving, setSaving]   = useState(false)
  const [tempPin, setTempPin] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/members')
    const data = await res.json()
    setMembers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = members.filter(m =>
    m.name.includes(search) || m.phone.includes(search)
  )

  const handleAdd = async () => {
    if (!form.name || !form.phone) return alert('이름과 전화번호를 입력해주세요')
    setSaving(true)
    const res = await fetch('/api/members', {
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

  const handlePhone = (v: string) => {
    const num = v.replace(/\D/g,'').slice(0,11)
    const fmt = num.length <= 3 ? num : num.length <= 7 ? `${num.slice(0,3)}-${num.slice(3)}` : `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`
    setForm(f => ({ ...f, phone: fmt }))
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>회원 관리</h1>
        <button onClick={() => setShowAdd(true)} style={{ marginLeft: 'auto', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          + 회원 추가
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
        {/* 검색 */}
        <input className="input-base" placeholder="이름 또는 전화번호 검색" value={search}
          onChange={e => setSearch(e.target.value)} style={{ marginBottom: '1rem' }} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
            <p>등록된 회원이 없습니다</p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', overflow: 'hidden' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>전화번호</th>
                  <th>상태</th>
                  <th>등록일</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td>{m.phone}</td>
                    <td>
                      <span style={{ background: m.is_active ? '#dcfce7' : '#fee2e2', color: m.is_active ? '#15803d' : '#b91c1c', fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: '9999px' }}>
                        {m.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{new Date(m.created_at).toLocaleDateString('ko-KR')}</td>
                    <td>
                      <Link href={`/owner/members/${m.id}`} style={{ color: '#16A34A', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none' }}>상세 ›</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 회원 추가 모달 */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>회원 직접 등록</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>이름</label>
                <input className="input-base" placeholder="홍길동" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>전화번호</label>
                <input className="input-base" placeholder="010-0000-0000" value={form.phone} onChange={e => handlePhone(e.target.value)} inputMode="numeric" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
              <button onClick={handleAdd} disabled={saving} style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '등록 중...' : '등록 (임시PIN: 123456)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 등록 완료 모달 */}
      {tempPin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', maxWidth: '320px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h3 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>등록 완료!</h3>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>첫 로그인 시 PIN 변경이 필요합니다</p>
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
