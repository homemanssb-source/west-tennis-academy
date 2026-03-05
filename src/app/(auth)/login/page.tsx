'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function normalizePhone(p: string): string {
    const digits = p.replace(/\D/g, '')
    if (digits.startsWith('010') && digits.length === 11) return '+82' + digits.slice(1)
    if (digits.startsWith('82') && digits.length === 11) return '+' + digits
    return p
  }

  async function handleNext() {
    if (!phone.trim()) { setError('전화번호를 입력해 주세요.'); return }
    setLoading(true); setError('')
    try {
      const normalized = normalizePhone(phone)
      const res = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      sessionStorage.setItem('reg_phone', normalized)
      if (data.exists && data.hasPin) {
        router.push('/pin-login')
      } else if (data.exists && !data.hasPin) {
        router.push('/set-pin')
      } else {
        router.push('/onboarding')
      }
    } catch (e: any) {
      setError(e.message ?? '오류가 발생했습니다.')
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

        <div className="mb-2">
          <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">
            전화번호
          </label>
          <input
            type="tel"
            className="wta-input font-mono text-lg tracking-widest text-center"
            placeholder="010-0000-0000"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNext()}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleNext}
          disabled={loading}
          className="wta-btn-primary mt-4 disabled:opacity-50"
        >
          {loading ? '확인 중...' : '다음 →'}
        </button>
      </div>
    </div>
  )
}