'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function PinLoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const p = sessionStorage.getItem('reg_phone') ?? ''
    if (!p) { router.replace('/login'); return }
    setPhone(p)
    setTimeout(() => inputs.current[0]?.focus(), 100)
  }, [])

  function handleChange(i: number, val: string) {
    if (!/^\d?$/.test(val)) return
    const next = [...pin]
    next[i] = val
    setPin(next)
    if (val && i < 5) inputs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !pin[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  async function handleSubmit() {
    const pinStr = pin.join('')
    if (pinStr.length !== 6) { setError('PIN 6자리를 입력해 주세요.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin: pinStr }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const roleHome: Record<string, string> = {
        member: '/home',
        coach: '/coach/dashboard',
        payment_manager: '/payment/dashboard',
        admin: '/admin/dashboard',
      }
      router.replace(roleHome[data.role] ?? '/home')
    } catch (e: any) {
      setError(e.message ?? '오류가 발생했습니다.')
      setPin(['', '', '', '', '', ''])
      setTimeout(() => inputs.current[0]?.focus(), 100)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#F0F7F0]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="font-oswald text-4xl font-bold tracking-[4px] text-[#1B4D2E] mb-1">WEST</div>
          <div className="font-oswald text-4xl font-bold tracking-[4px] text-[#1B4D2E]">TENNIS</div>
          <div className="text-xs text-[#5A8A5A] tracking-[3px] mt-2">ACADEMY</div>
        </div>

        <p className="text-center text-sm text-[#5A8A5A] mb-6">PIN 번호를 입력해 주세요</p>

        <div className="flex gap-3 justify-center mb-6">
          {pin.map((v, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={v}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className="w-12 h-12 text-center text-xl font-bold border-2 border-[#C5DEC5] rounded-xl bg-white focus:border-[#1B4D2E] focus:outline-none transition-colors"
            />
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || pin.join('').length !== 6}
          className="wta-btn-primary disabled:opacity-50"
        >
          {loading ? '확인 중...' : '로그인'}
        </button>

        <button
          onClick={() => router.push('/login')}
          className="w-full mt-3 text-sm text-[#5A8A5A] text-center"
        >
          다른 번호로 로그인
        </button>
      </div>
    </div>
  )
}
