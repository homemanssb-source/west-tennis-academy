'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DAYS = ['mon','tue','wed','thu','fri','sat','sun']
const DAY_LABELS: Record<string, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
}
const TIMES = ['06:00','07:00','08:00','09:00','10:00','11:00','17:00','18:00','19:00','20:00']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    name: '', gender: '', birth_date: '', tennis_career: '',
    coach_id: '', lesson_type: 'individual',
    preferred_days: [] as string[],
    preferred_times: [] as string[],
    notes: '', auto_rollover: true,
  })
  const [phone, setPhone] = useState('')
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([])
  const [termsChecked, setTermsChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const p = sessionStorage.getItem('reg_phone') ?? ''
    setPhone(p)
    async function loadCoaches() {
      const { data } = await supabase.from('profiles').select('id, name').eq('role', 'coach').eq('is_active', true)
      setCoaches(data ?? [])
    }
    loadCoaches()
  }, [])

  async function handleSubmit() {
    if (!form.name.trim()) { setError('성명을 입력해 주세요.'); return }
    if (!form.gender) { setError('성별을 선택해 주세요.'); return }
    if (!form.coach_id) { setError('담당 코치를 선택해 주세요.'); return }
    if (form.preferred_days.length === 0) { setError('희망 요일을 선택해 주세요.'); return }
    if (form.preferred_times.length === 0) { setError('희망 시간을 선택해 주세요.'); return }
    if (!termsChecked) { setError('이용약관에 동의해 주세요.'); return }
    if (!phone) { setError('전화번호 정보가 없습니다.'); return }
    setLoading(true); setError('')
    try {
      const digits = phone.replace(/\D/g, '')
      const normalized = digits.startsWith('010') && digits.length === 11 ? '+82' + digits.slice(1) : phone
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      sessionStorage.setItem('new_user_id', data.userId)
      router.push('/set-pin')
    } catch (e: any) {
      setError(e.message ?? '등록에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-[#F0F7F0]/95 border-b border-[#1B4D2E]/10 flex items-center px-4 h-14">
        <div className="font-bold text-[#1B4D2E]">회원 등록</div>
      </div>
      <div className="flex-1 px-4 pt-4 pb-16 space-y-4">
        <div className="space-y-3">
          <input className="w-full p-3 border rounded-xl" placeholder="성명" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <select className="w-full p-3 border rounded-xl" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
            <option value="">성별 선택</option>
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
          <select className="w-full p-3 border rounded-xl" value={form.coach_id} onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))}>
            <option value="">담당 코치 선택</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(d => (
              <button key={d} type="button" onClick={() => setForm(f => ({ ...f, preferred_days: f.preferred_days.includes(d) ? f.preferred_days.filter(x => x !== d) : [...f.preferred_days, d] }))}
                className={`px-3 py-1.5 rounded-full border text-sm ${form.preferred_days.includes(d) ? 'bg-[#1B4D2E] text-white' : 'bg-white'}`}>
                {DAY_LABELS[d]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {TIMES.map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, preferred_times: f.preferred_times.includes(t) ? f.preferred_times.filter(x => x !== t) : [...f.preferred_times, t] }))}
                className={`px-3 py-1.5 rounded-full border text-sm font-mono ${form.preferred_times.includes(t) ? 'bg-[#1B4D2E] text-white' : 'bg-white'}`}>
                {t}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)} />
            이용약관 및 개인정보 수집에 동의합니다
          </label>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button onClick={handleSubmit} disabled={loading} className="w-full py-3 bg-[#1B4D2E] text-white rounded-xl font-semibold disabled:opacity-50">
          {loading ? '등록 중...' : '다음 → PIN 설정'}
        </button>
      </div>
    </div>
  )
}
