'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [step, setStep] = useState<'phone' | 'pin'>('phone')
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function formatPhone(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  async function handlePhoneSubmit() {
    if (phone.replace(/\D/g, '').length < 11) {
      setError('전화번호를 올바르게 입력해 주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()

      if (data.isNewUser) {
        // 신규 가입 → 온보딩
        sessionStorage.setItem('reg_phone', phone)
        router.push('/onboarding')
        return
      }

      if (!data.hasPin) {
        setError('PIN이 설정되지 않았습니다. 관리자에게 문의하세요.')
        return
      }

      setUserName(data.name)
      sessionStorage.setItem('login_phone', phone)
      setStep('pin')
    } catch (e: any) {
      setError(e.message ?? '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handlePinInput(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...pin]
    next[idx] = digit
    setPin(next)
    if (digit && idx < 5) {
      document.getElementById(`pin-${idx + 1}`)?.focus()
    }
    if (next.every(d => d) && digit) {
      handlePinSubmit(next.join(''))
    }
  }

  function handlePinKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !pin[idx] && idx > 0) {
      document.getElementById(`pin-${idx - 1}`)?.focus()
    }
  }

  async function handlePinSubmit(inputPin: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin: inputPin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/')
    } catch (e: any) {
      setError(e.message ?? 'PIN이 올바르지 않습니다.')
      setPin(['', '', '', '', '', ''])
      setTimeout(() => document.getElementById('pin-0')?.focus(), 100)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-[#F0F7F0]/95 backdrop-blur-md border-b border-[#1B4D2E]/10 flex items-center justify-between px-4 h-14">
        <div className="font-oswald text-base font-semibold tracking-[2px] text-[#1B4D2E]">WEST TENNIS</div>
        <div className="text-[9px] text-[#5A8A5A] tracking-[1.5px]">ACADEMY</div>
      </div>

      <div className="flex-1 px-4 pt-12 pb-10 flex flex-col items-center">
        {/* 로고 */}
        <div className="w-16 h-16 rounded-2xl bg-[#1B4D2E] flex items-center justify-center text-white font-oswald text-2xl font-bold mb-8 shadow-lg">
          WT
        </div>

        {step === 'phone' ? (
          <div className="w-full max-w-xs">
            <h2 className="font-serif text-2xl font-semibold text-[#0F2010] mb-1 text-center">로그인</h2>
            <p className="text-sm text-[#5A8A5A] mb-8 text-center">전화번호를 입력해 주세요</p>

            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              onKeyDown={e => e.key === 'Enter' && handlePhoneSubmit()}
              placeholder="010-0000-0000"
              className="w-full py-4 px-4 rounded-2xl bg-white border-2 border-[#1B4D2E]/15
                         font-mono text-2xl tracking-[4px] text-center mb-6 transition-all
                         focus:border-[#3DB840] focus:outline-none text-[#0F2010]"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 text-center">
                {error}
              </div>
            )}

            <button
              onClick={handlePhoneSubmit}
              disabled={loading}
              className="wta-btn-primary disabled:opacity-50"
            >
              {loading ? '확인 중...' : '다음 →'}
            </button>
          </div>
        ) : (
          <div className="w-full max-w-xs flex flex-col items-center">
            <h2 className="font-serif text-2xl font-semibold text-[#0F2010] mb-1 text-center">
              {userName}님, 환영합니다
            </h2>
            <p className="text-sm text-[#5A8A5A] mb-8 text-center">PIN 6자리를 입력해 주세요</p>

            <div className="flex gap-2.5 mb-6 justify-center">
              {pin.map((digit, i) => (
                <input
                  key={i}
                  id={`pin-${i}`}
                  type="tel"
                  maxLength={1}
                  value={digit ? '●' : ''}
                  onChange={e => handlePinInput(i, e.target.value)}
                  onKeyDown={e => handlePinKeyDown(i, e)}
                  autoFocus={i === 0}
                  className={`w-11 h-14 rounded-xl text-center font-mono text-2xl font-bold transition-all
                    bg-white border-[1.5px] text-[#1B4D2E]
                    ${digit ? 'border-[#3DB840] bg-[#3DB840]/6' : 'border-[#1B4D2E]/15'}
                    focus:border-[#1B4D2E] focus:outline-none`}
                />
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 text-center w-full">
                {error}
              </div>
            )}

            {loading && <div className="text-sm text-[#5A8A5A] mb-4">로그인 중...</div>}

            <button
              onClick={() => { setStep('phone'); setPin(['', '', '', '', '', '']); setError('') }}
              className="text-sm text-[#5A8A5A] underline mt-2"
            >
              ← 전화번호 다시 입력
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
