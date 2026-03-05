'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ProgressBar from '@/components/ui/ProgressBar'

const STEPS = [
  { label: 'QR스캔' }, { label: '전화인증' }, { label: '회원등록' },
  { label: '레슨예약' }, { label: '완료' },
]

export default function VerifyPage() {
  const router = useRouter()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(300)
  const [phone, setPhone] = useState('')
  const [displayPhone, setDisplayPhone] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const p = sessionStorage.getItem('otp_phone') ?? ''
    const d = sessionStorage.getItem('otp_phone_display') ?? ''
    if (!p) { router.replace('/login'); return }
    setPhone(p)
    setDisplayPhone(d)
  }, [])

  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  const timeStr = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  function handleInput(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus()
    if (next.every(d => d) && digit) handleVerify(next.join(''))
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
  }

  async function handleVerify(token?: string) {
    const code = token ?? otp.join('')
    if (code.length < 6) { setError('6자리를 모두 입력해 주세요.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, token: code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.isNewUser) {
        router.push('/onboarding')
      } else {
        router.push('/')
      }
    } catch (e: any) {
      setError(e.message ?? '인증에 실패했습니다.')
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setSeconds(300)
    setOtp(['', '', '', '', '', ''])
    setError('')
    await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: displayPhone }),
    })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-[#F0F7F0]/95 backdrop-blur-md border-b border-forest/10 flex items-center px-4 h-14">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-forest/8 border border-forest/15 flex items-center justify-center text-forest mr-3">←</button>
        <div className="font-oswald text-base font-semibold tracking-[2px] text-forest">OTP 인증</div>
      </div>

      <ProgressBar steps={STEPS} currentStep={1} />

      <div className="flex-1 px-4 pt-8 pb-10 flex flex-col items-center">
        <div className="text-5xl mb-4">📲</div>
        <h2 className="font-serif text-2xl font-semibold text-[#0F2010] mb-2 text-center">인증번호 입력</h2>
        <p className="text-sm text-[#5A8A5A] mb-8 text-center">
          <span className="text-[#0F2010] font-medium">{displayPhone}</span>으로 발송된 6자리
        </p>

        <div className="flex gap-2.5 mb-4 w-full max-w-xs justify-center">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el }}
              type="tel"
              maxLength={1}
              value={digit}
              onChange={e => handleInput(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`w-11 h-14 rounded-xl text-center font-mono text-2xl font-bold transition-all
                bg-white border-[1.5px] text-forest
                ${digit ? 'border-lime bg-lime/6' : 'border-forest/15'}
                focus:border-forest focus:ring-2 focus:ring-forest/15`}
            />
          ))}
        </div>

        <div className={`font-mono text-lg mb-6 font-medium ${seconds < 60 ? 'text-clay' : 'text-[#5A8A5A]'}`}>
          ⏱ {timeStr}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 w-full max-w-xs text-center">
            {error}
          </div>
        )}

        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => handleVerify()}
            disabled={loading || otp.some(d => !d)}
            className="wta-btn-primary disabled:opacity-50"
          >
            {loading ? '인증 중...' : '✅ 인증 완료'}
          </button>
          <button
            onClick={handleResend}
            disabled={seconds > 240}
            className="wta-btn-secondary disabled:opacity-40"
          >
            🔄 재전송
          </button>
        </div>
      </div>
    </div>
  )
}
