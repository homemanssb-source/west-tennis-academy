'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  role: string
  label: string
  color: string
  emoji: string
}

export default function LoginForm({ role, label, color, emoji }: Props) {
  const router = useRouter()
  const [phone, setPhone]   = useState('')
  const [pin, setPin]       = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handlePhone = (v: string) => {
    const num = v.replace(/\D/g, '').slice(0, 11)
    const fmt = num.length <= 3 ? num
      : num.length <= 7 ? `${num.slice(0,3)}-${num.slice(3)}`
      : `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`
    setPhone(fmt)
  }

  const handleSubmit = async () => {
    setError('')
    if (phone.replace(/-/g,'').length < 10) return setError('전화번호를 입력해주세요')
    if (pin.length !== 6) return setError('PIN 6자리를 입력해주세요')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, role }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? '로그인 실패')
      router.replace(data.redirect)
    } catch {
      setError('서버 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mobile-wrap flex flex-col">
      {/* 헤더 */}
      <div style={{ background: color }} className="px-6 pt-14 pb-10 text-center text-white">
        <div className="text-5xl mb-3">{emoji}</div>
        <div className="font-title text-3xl font-bold tracking-widest mb-1">WTA</div>
        <p className="text-sm opacity-80">{label}</p>
      </div>

      {/* 폼 */}
      <div className="flex-1 px-6 py-8 flex flex-col gap-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">전화번호</label>
          <input
            className="input-base"
            placeholder="010-0000-0000"
            value={phone}
            onChange={e => handlePhone(e.target.value)}
            inputMode="numeric"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">PIN 6자리</label>
          {/* PIN 박스 - 클릭하면 숨겨진 input 포커스 */}
          <div
            className="flex gap-2 cursor-pointer"
            onClick={() => inputRef.current?.focus()}
          >
            {Array.from({length: 6}).map((_, i) => (
              <div
                key={i}
                className={`pin-box ${pin.length > i ? 'filled' : ''} ${pin.length === i ? 'active' : ''}`}
              >
                {pin.length > i ? '●' : ''}
              </div>
            ))}
          </div>
          {/* 숨겨진 input - 실제 입력 처리 */}
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))}
            style={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'none',
              width: 1,
              height: 1,
            }}
            autoComplete="off"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-semibold">
            {error}
          </div>
        )}

        <button
          className="btn-primary mt-2"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </div>
    </div>
  )
}