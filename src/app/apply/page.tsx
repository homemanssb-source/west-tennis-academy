'use client'

import { useState } from 'react'

type Step = 'form' | 'pin' | 'done'

export default function ApplyPage() {
  const [step, setStep] = useState<Step>('form')
  const [form, setForm] = useState({
    name: '', phone: '', birth_date: '', address: '',
    emergency_contact: '', health_notes: '', desired_schedule: ''
  })
  const [pin, setPin]         = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const handlePhone = (v: string) => {
    const num = v.replace(/\D/g, '').slice(0, 11)
    const fmt = num.length <= 3 ? num : num.length <= 7
      ? `${num.slice(0,3)}-${num.slice(3)}`
      : `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`
    setForm(f => ({ ...f, phone: fmt }))
  }

  // STEP1 → STEP2 (PIN 설정으로 이동)
  const handleNext = () => {
    setError('')
    if (!form.name.trim()) return setError('이름을 입력해주세요')
    if (!form.phone.trim()) return setError('전화번호를 입력해주세요')
    if (form.phone.replace(/-/g,'').length < 10) return setError('올바른 전화번호를 입력해주세요')
    setStep('pin')
  }

  // STEP2 → 최종 제출 (즉시 가입)
  const handleSubmit = async () => {
    setError('')
    if (pin.length !== 6) return setError('PIN은 숫자 6자리입니다')
    if (!/^\d{4}$/.test(pin)) return setError('PIN은 숫자만 입력 가능합니다')
    if (pin !== pinConfirm) return setError('PIN이 일치하지 않습니다')

    setSaving(true)
    const res = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, pin }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setError(data.error ?? '오류가 발생했습니다')
    setStep('done')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem',
    borderRadius: '0.75rem', border: '1.5px solid #e5e7eb',
    fontSize: '0.9rem', fontFamily: 'Noto Sans KR, sans-serif',
    outline: 'none', boxSizing: 'border-box', color: '#111827',
    background: 'white',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem', fontWeight: 700, color: '#6b7280',
    display: 'block', marginBottom: '6px',
  }

  // ── 완료 화면 ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎾</div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: '#16A34A', marginBottom: '0.5rem' }}>가입 완료!</div>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            WTA 회원이 되셨습니다.<br/>
            설정한 PIN으로 바로 로그인하세요!
          </p>
          <a href="/auth/member"
            style={{ display: 'inline-block', padding: '0.875rem 2rem', borderRadius: '0.875rem', background: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.95rem', textDecoration: 'none', fontFamily: 'Noto Sans KR, sans-serif' }}>
            로그인하러 가기
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f9fafb' }}>
      {/* 헤더 */}
      <div style={{ background: '#16A34A', padding: '2rem 1.5rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2rem', fontWeight: 700, color: 'white', letterSpacing: '2px' }}>WTA</div>
        <div style={{ color: 'rgba(255,255,255,.8)', fontSize: '0.8rem', marginTop: '2px' }}>서부 테니스 아카데미</div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem', marginTop: '0.75rem' }}>회원 가입</div>

        {/* 스텝 인디케이터 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          {['기본 정보', 'PIN 설정'].map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '1.5rem', height: '1.5rem', borderRadius: '50%',
                background: step === 'pin' && i === 0 ? 'rgba(255,255,255,.4)' :
                             (i === 0 || step === 'pin') ? 'white' : 'rgba(255,255,255,.3)',
                color: step === 'pin' && i === 0 ? 'white' :
                       (i === 0 || step === 'pin') ? '#16A34A' : 'white',
                fontWeight: 700, fontSize: '0.75rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {step === 'pin' && i === 0 ? '✓' : i + 1}
              </div>
              <span style={{ color: 'rgba(255,255,255,.9)', fontSize: '0.75rem', fontWeight: 600 }}>{label}</span>
              {i === 0 && <span style={{ color: 'rgba(255,255,255,.5)', fontSize: '0.8rem' }}>›</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ── STEP 1: 기본 정보 ── */}
        {step === 'form' && (
          <>
            <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>
                기본 정보 <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>* 필수</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div>
                  <label style={labelStyle}>이름 *</label>
                  <input style={inputStyle} placeholder="홍길동" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>전화번호 * (로그인 ID로 사용)</label>
                  <input style={inputStyle} placeholder="010-0000-0000" value={form.phone}
                    onChange={e => handlePhone(e.target.value)} inputMode="numeric" />
                </div>
                <div>
                  <label style={labelStyle}>생년월일</label>
                  <input type="date" style={inputStyle} value={form.birth_date}
                    onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>
                추가 정보 <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>선택</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div>
                  <label style={labelStyle}>주소</label>
                  <input style={inputStyle} placeholder="서울시..." value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>비상연락처</label>
                  <input style={inputStyle} placeholder="010-0000-0000" value={form.emergency_contact}
                    onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} inputMode="numeric" />
                </div>
                <div>
                  <label style={labelStyle}>건강 특이사항</label>
                  <textarea style={{ ...inputStyle, resize: 'none' }} placeholder="부상이력, 건강상태 등"
                    value={form.health_notes}
                    onChange={e => setForm(f => ({ ...f, health_notes: e.target.value }))} rows={2} />
                </div>
                <div>
                  <label style={labelStyle}>희망 레슨 일정</label>
                  <textarea style={{ ...inputStyle, resize: 'none' }} placeholder="예) 주말 오전, 평일 2회 희망"
                    value={form.desired_schedule}
                    onChange={e => setForm(f => ({ ...f, desired_schedule: e.target.value }))} rows={2} />
                </div>
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.875rem', color: '#b91c1c', fontSize: '0.875rem', fontWeight: 600 }}>
                {error}
              </div>
            )}

            <button onClick={handleNext}
              style={{ padding: '1rem', borderRadius: '0.875rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '1rem' }}>
              다음 — PIN 설정 →
            </button>
          </>
        )}

        {/* ── STEP 2: PIN 설정 ── */}
        {step === 'pin' && (
          <>
            <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.5rem' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
                🔐 로그인 PIN 설정
              </div>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                앱 로그인에 사용할 PIN 6자리를 설정해주세요.<br/>
                잘 기억할 수 있는 번호로 설정하세요.
              </p>

              {/* 가입자 확인 */}
              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 700 }}>
                  👤 {form.name} ({form.phone})
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>PIN 번호 (숫자 6자리) *</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    style={{ ...inputStyle, letterSpacing: '0.5rem', fontSize: '1.25rem', textAlign: 'center' }}
                    placeholder="• • • •"
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>PIN 확인 *</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    style={{
                      ...inputStyle,
                      letterSpacing: '0.5rem', fontSize: '1.25rem', textAlign: 'center',
                      borderColor: pinConfirm && pin !== pinConfirm ? '#fca5a5' :
                                   pinConfirm && pin === pinConfirm ? '#86efac' : '#e5e7eb',
                    }}
                    placeholder="• • • •"
                    value={pinConfirm}
                    onChange={e => setPinConfirm(e.target.value.replace(/\D/g,'').slice(0,6))}
                  />
                  {pinConfirm.length === 4 && pin !== pinConfirm && (
                    <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px' }}>PIN이 일치하지 않습니다</div>
                  )}
                  {pinConfirm.length === 4 && pin === pinConfirm && (
                    <div style={{ fontSize: '0.75rem', color: '#16A34A', marginTop: '4px' }}>✓ PIN이 일치합니다</div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.875rem', color: '#b91c1c', fontSize: '0.875rem', fontWeight: 600 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <button onClick={() => { setStep('form'); setError('') }}
                style={{ flex: 1, padding: '1rem', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                ‹ 이전
              </button>
              <button onClick={handleSubmit} disabled={saving || pin.length !== 6 || pin !== pinConfirm}
                style={{ flex: 2, padding: '1rem', borderRadius: '0.875rem', border: 'none', background: (saving || pin.length !== 6 || pin !== pinConfirm) ? '#e5e7eb' : '#16A34A', color: (saving || pin.length !== 6 || pin !== pinConfirm) ? '#9ca3af' : 'white', fontWeight: 700, cursor: (saving || pin.length !== 6 || pin !== pinConfirm) ? 'not-allowed' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '1rem' }}>
                {saving ? '가입 중...' : '🎾 가입 완료'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}