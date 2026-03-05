'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SetPinPage() {
  const router = useRouter()
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [pinConfirm, setPinConfirm] = useState(['', '', '', '', '', ''])
  const [step, setStep] = useState<'set' | 'confirm'>('set')
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const id = sessionStorage.getItem('new_user_id') ?? ''
    if (!id) { router.replace('/login'); return }
    setUserId(id)
    setTimeout(() => document.getElementById('pin-0')?.focus(), 100)
  }, [])

  function handlePinInput(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...pin]; next[idx] = digit; setPin(next)
    if (digit && idx < 5) document.getElementById(`pin-${idx + 1}`)?.focus()
    if (next.every(d => d) && digit) {
      setTimeout(() => { setStep('confirm'); setTimeout(() => document.getElementById('confirm-0')?.focus(), 100) }, 200)
    }
  }

  function handleConfirmInput(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...pinConfirm]; next[idx] = digit; setPinConfirm(next)
    if (digit && idx < 5) document.getElementById(`confirm-${idx + 1}`)?.focus()
    if (next.every(d => d) && digit) handleSubmit(next.join(''))
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent, type: 'pin' | 'confirm') {
    if (e.key === 'Backspace') {
      if (type === 'pin' && !pin[idx] && idx > 0) document.getElementById(`pin-${idx - 1}`)?.focus()
      if (type === 'confirm' && !pinConfirm[idx] && idx > 0) document.getElementById(`confirm-${idx - 1}`)?.focus()
    }
  }

  async function handleSubmit(confirmPin: string) {
    const pinStr = pin.join('')
    if (pinStr !== confirmPin) {
      setError('PIN이 일치하지 않습니다. 다시 입력해 주세요.')
      setPinConfirm(['', '', '', '', '', ''])
      setStep('set'); setPin(['', '', '', '', '', ''])
      setTimeout(() => document.getElementById('pin-0')?.focus(), 100)
      return
    }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pin: pinStr }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      sessionStorage.removeItem('new_user_id')
      sessionStorage.removeItem('reg_phone')
      router.push('/')
    } catch (e: any) {
      setError(e.message ?? 'PIN 설정에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const boxClass = (digit: string) =>
    `w-11 h-14 rounded-xl text-center font-mono text-2xl font-bold transition-all bg-white border-[1.5px] text-[#1B4D2E] focus:outline-none focus:border-[#1B4D2E] focus:ring-2 focus:ring-[#1B4D2E]/15 ${digit ? 'border-[#3DB840] bg-[#3DB840]/6' : 'border-[#1B4D2E]/15'}`

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-[#F0F7F0]/95 backdrop-blur-md border-b border-[#1B4D2E]/10 flex items-center px-4 h-14">
        <div className="font-oswald text-base font-semibold tracking-[2px] text-[#1B4D2E]">PIN 설정</div>
      </div>
      <div className="flex-1 px-4 pt-12 pb-10 flex flex-col items-center">
        <div className="text-5xl mb-4">{step === 'set' ? '🔐' : '✅'}</div>
        <h2 className="font-serif text-2xl font-semibold text-[#0F2010] mb-2 text-center">
          {step === 'set' ? 'PIN 번호 설정' : 'PIN 번호 확인'}
        </h2>
        <p className="text-sm text-[#5A8A5A] mb-8 text-center">
          {step === 'set' ? '로그인에 사용할 PIN 6자리를 설정하세요' : 'PIN 번호를 한 번 더 입력해 주세요'}
        </p>
        {step === 'set' ? (
          <div className="flex gap-2.5 mb-8">
            {pin.map((digit, i) => (
              <input key={i} id={`pin-${i}`} type="tel" maxLength={1}
                value={digit ? '●' : ''} onChange={e => handlePinInput(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e, 'pin')} className={boxClass(digit)} />
            ))}
          </div>
        ) : (
          <div className="flex gap-2.5 mb-8">
            {pinConfirm.map((digit, i) => (
              <input key={i} id={`confirm-${i}`} type="tel" maxLength={1}
                value={digit ? '●' : ''} onChange={e => handleConfirmInput(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e, 'confirm')} className={boxClass(digit)} />
            ))}
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 text-center w-full max-w-xs">{error}</div>}
        {loading && <div className="text-sm text-[#5A8A5A]">저장 중...</div>}
        {step === 'confirm' && (
          <button onClick={() => { setStep('set'); setPin(['', '', '', '', '', '']); setPinConfirm(['', '', '', '', '', '']) }}
            className="mt-4 text-sm text-[#5A8A5A] underline">← 다시 입력하기</button>
        )}
        <div className="mt-8 bg-[#EAF3EA] border border-[#3DB840]/20 rounded-xl p-3 w-full max-w-xs text-xs text-[#2A5A2A] leading-relaxed">
          🔒 PIN은 앱 로그인에만 사용됩니다. 타인에게 공유하지 마세요.
        </div>
      </div>
    </div>
  )
}
