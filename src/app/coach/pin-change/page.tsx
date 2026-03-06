'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CoachPinChangePage() {
  const router = useRouter()
  const [newPin, setNewPin]       = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (newPin.length !== 6)    return setError('PIN은 6자리여야 합니다')
    if (newPin !== confirm)     return setError('PIN이 일치하지 않습니다')
    if (newPin === '123456')    return setError('임시 PIN은 사용할 수 없습니다')

    setLoading(true)
    const res = await fetch('/api/auth/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_pin: newPin }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    router.replace('/coach')
  }

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#1d4ed8', padding: '3rem 1.5rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔑</div>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>PIN 변경 필요</div>
        <p style={{ color: 'rgba(255,255,255,.75)', fontSize: '0.8rem', marginTop: '0.5rem' }}>첫 로그인 시 PIN을 변경해야 합니다</p>
      </div>

      <div style={{ flex: 1, padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>새 PIN 6자리</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {Array.from({length:6}).map((_,i) => (
              <div key={i} className={`pin-box ${newPin.length > i ? 'filled' : ''} ${newPin.length === i ? 'active' : ''}`}>
                {newPin.length > i ? '●' : ''}
              </div>
            ))}
          </div>
          <input className="input-base" placeholder="숫자 6자리" value={newPin}
            onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,6))}
            inputMode="numeric" maxLength={6} />
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>PIN 확인</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {Array.from({length:6}).map((_,i) => (
              <div key={i} className={`pin-box ${confirm.length > i ? 'filled' : ''} ${confirm.length === i ? 'active' : ''}`}>
                {confirm.length > i ? '●' : ''}
              </div>
            ))}
          </div>
          <input className="input-base" placeholder="PIN 한번 더" value={confirm}
            onChange={e => setConfirm(e.target.value.replace(/\D/g,'').slice(0,6))}
            inputMode="numeric" maxLength={6} />
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.875rem', color: '#b91c1c', fontSize: '0.875rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading}
          style={{ padding: '1rem', borderRadius: '0.75rem', border: 'none', background: '#1d4ed8', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
          {loading ? '변경 중...' : 'PIN 변경 완료'}
        </button>
      </div>
    </div>
  )
}
