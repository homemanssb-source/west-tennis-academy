'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [name, setName]         = useState('')
  const [phone, setPhone]       = useState('')
  const [pin, setPin]           = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!name.trim())            return setError('이름을 입력해주세요')
    if (phone.length < 10)       return setError('전화번호를 정확히 입력해주세요')
    if (pin.length !== 6)        return setError('PIN은 6자리여야 합니다')
    if (pin !== pinConfirm)      return setError('PIN이 일치하지 않습니다')

    setLoading(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, pin }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? '등록 실패')
      router.replace('/owner')
    } catch {
      setError('서버 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handlePhone = (v: string) => {
    const num = v.replace(/\D/g, '').slice(0, 11)
    const fmt = num.length <= 3 ? num
      : num.length <= 7 ? `${num.slice(0,3)}-${num.slice(3)}`
      : `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`
    setPhone(fmt)
  }

  const handlePin = (v: string, type: 'pin' | 'confirm') => {
    const num = v.replace(/\D/g, '').slice(0, 6)
    type === 'pin' ? setPin(num) : setPinConfirm(num)
  }

  return (
    <div className="mobile-wrap flex flex-col">
      {/* 헤더 */}
      <div className="bg-primary-600 px-6 pt-12 pb-8 text-center text-white">
        <div className="font-title text-4xl font-bold tracking-widest mb-2">WTA</div>
        <p className="text-sm opacity-80">서부 테니스 아카데미</p>
      </div>

      {/* 본문 */}
      <div className="flex-1 px-6 py-6">
        {/* 안내 뱃지 */}
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
          <span className="text-2xl">👑</span>
          <div>
            <p className="font-bold text-yellow-800 text-sm">운영자 최초 등록</p>
            <p className="text-yellow-700 text-xs mt-0.5">이 화면은 최초 1회만 표시됩니다</p>
          </div>
        </div>

        {/* 폼 */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">이름</label>
            <input
              className="input-base"
              placeholder="홍길동"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">전화번호</label>
            <input
              className="input-base"
              placeholder="010-0000-0000"
              value={phone}
              onChange={e => handlePhone(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">PIN 6자리 설정</label>
            <div className="flex gap-2">
              {Array.from({length: 6}).map((_, i) => (
                <div key={i} className={`pin-box ${pin.length > i ? 'filled' : ''} ${pin.length === i ? 'active' : ''}`}>
                  {pin.length > i ? '●' : ''}
                </div>
              ))}
            </div>
            <input
              className="input-base mt-2"
              placeholder="숫자 6자리"
              value={pin}
              onChange={e => handlePin(e.target.value, 'pin')}
              inputMode="numeric"
              maxLength={6}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">PIN 확인</label>
            <div className="flex gap-2">
              {Array.from({length: 6}).map((_, i) => (
                <div key={i} className={`pin-box ${pinConfirm.length > i ? 'filled' : ''} ${pinConfirm.length === i ? 'active' : ''}`}>
                  {pinConfirm.length > i ? '●' : ''}
                </div>
              ))}
            </div>
            <input
              className="input-base mt-2"
              placeholder="PIN 한번 더 입력"
              value={pinConfirm}
              onChange={e => handlePin(e.target.value, 'confirm')}
              inputMode="numeric"
              maxLength={6}
            />
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-semibold">
            {error}
          </div>
        )}

        {/* 버튼 */}
        <button
          className="btn-primary w-full mt-6"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '등록 중...' : '운영자 등록 완료'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          등록 후 통합 대시보드로 이동합니다
        </p>
      </div>
    </div>
  )
}
