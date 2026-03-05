'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DAYS = ['mon','tue','wed','thu','fri','sat','sun']
const DAY_LABELS: Record<string, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
}
const TIMES = ['06:00','07:00','08:00','09:00','10:00','11:00','17:00','18:00','19:00','20:00']
const LESSON_TYPES = [
  { value: 'individual',   label: '개인레슨',   isGroup: false },
  { value: 'group_2',      label: '단체 2:1',   isGroup: true  },
  { value: 'group_3',      label: '단체 3:1',   isGroup: true  },
  { value: 'group_4',      label: '단체 4:1',   isGroup: true  },
  { value: 'group_other',  label: '그룹(기타)', isGroup: true  },
]

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

  function toggleDay(day: string) {
    setForm(f => ({ ...f, preferred_days: f.preferred_days.includes(day) ? f.preferred_days.filter(d => d !== day) : [...f.preferred_days, day] }))
  }
  function toggleTime(time: string) {
    setForm(f => ({ ...f, preferred_times: f.preferred_times.includes(time) ? f.preferred_times.filter(t => t !== time) : [...f.preferred_times, time] }))
  }
  function normalizePhone(p: string): string {
    const digits = p.replace(/\D/g, '')
    if (digits.startsWith('010') && digits.length === 11) return '+82' + digits.slice(1)
    return p
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError('성명을 입력해 주세요.'); return }
    if (!form.gender) { setError('성별을 선택해 주세요.'); return }
    if (!form.coach_id) { setError('담당 코치를 선택해 주세요.'); return }
    if (form.preferred_days.length === 0) { setError('희망 요일을 선택해 주세요.'); return }
    if (form.preferred_times.length === 0) { setError('희망 시간을 선택해 주세요.'); return }
    if (!termsChecked) { setError('이용약관에 동의해 주세요.'); return }
    if (!phone) { setError('전화번호 정보가 없습니다. 처음부터 다시 시도해 주세요.'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizePhone(phone), ...form }),
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
      <div className="bg-[#F0F7F0]/95 backdrop-blur-md border-b border-[#1B4D2E]/10 flex items-center px-4 h-14">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-[#1B4D2E]/8 border border-[#1B4D2E]/15 flex items-center justify-center text-[#1B4D2E] mr-3">←</button>
        <div className="font-oswald text-base font-semibold tracking-[2px] text-[#1B4D2E]">회원 등록</div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-16">
        <h2 className="font-serif text-2xl font-semibold text-[#0F2010] mb-1">회원 정보 입력</h2>
        <p className="text-sm text-[#5A8A5A] mb-6">정확한 정보로 최적의 레슨 배정</p>

        <div className="wta-section-label"><span className="opacity-40">//</span> 기본 정보</div>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">성명 <span className="text-[#C85A1E]">*</span></label>
            <input className="wta-input" placeholder="홍길동" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">성별 <span className="text-[#C85A1E]">*</span></label>
              <select className="wta-input" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="">선택</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">생년월일</label>
              <input type="date" className="wta-input" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">연락처</label>
            <div className="relative">
              <input className="wta-input opacity-60 cursor-not-allowed" value={phone} disabled />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">🔒</span>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">테니스 경력</label>
            <select className="wta-input" value={form.tennis_career} onChange={e => setForm(f => ({ ...f, tennis_career: e.target.value }))}>
              <option value="">처음 시작</option>
              <option value="under_6m">6개월 미만</option>
              <option value="under_1y">1년 미만</option>
              <option value="under_2y">2년 미만</option>
              <option value="over_3y">3년 이상</option>
            </select>
          </div>
        </div>

        <div className="wta-section-label mt-6"><span className="opacity-40">//</span> 레슨 설정</div>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">담당 코치 <span className="text-[#C85A1E]">*</span></label>
            <select className="wta-input" value={form.coach_id} onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))}>
              <option value="">코치 선택</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">레슨 타입 <span className="text-[#C85A1E]">*</span></label>
            <div className="flex flex-wrap gap-2">
              {LESSON_TYPES.map(t => (
                <button key={t.value} onClick={() => setForm(f => ({ ...f, lesson_type: t.value }))}
                  className={`wta-chip ${form.lesson_type === t.value ? 'wta-chip-selected' : ''}`}>{t.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">희망 요일 <span className="text-[#C85A1E]">*</span></label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => (
                <button key={d} onClick={() => toggleDay(d)}
                  className={`wta-chip ${form.preferred_days.includes(d) ? 'wta-chip-selected' : ''}`}>{DAY_LABELS[d]}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">희망 시간 <span className="text-[#C85A1E]">*</span></label>
            <div className="flex flex-wrap gap-2">
              {TIMES.map(t => (
                <button key={t} onClick={() => toggleTime(t)}
                  className={`wta-chip font-mono text-xs ${form.preferred_times.includes(t) ? 'wta-chip-selected' : ''}`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">비고</label>
            <textarea className="wta-input resize-none" rows={3} placeholder="부상, 건강 특이사항 등"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <div className="wta-section-label mt-6"><span className="opacity-40">//</span> 이용 약관</div>
        <div className="bg-[#F5FAF5] border border-[#1B4D2E]/10 rounded-xl p-4 max-h-40 overflow-y-auto text-xs text-[#2A5A2A] leading-relaxed mb-3">
          <div className="mb-2"><strong className="text-[#0F2010]">제1조 (레슨 시간 및 지각/결석)</strong><br />레슨 시작 후 10분 이상 지각 시 해당 시간은 소진됩니다.</div>
          <div className="mb-2"><strong className="text-[#0F2010]">제2조 (보강)</strong><br />보강은 코치 승인 후 확정됩니다. 당일 취소 + 미납 시 보강 불가합니다.</div>
          <div><strong className="text-[#0F2010]">제3조 (개인정보)</strong><br />수집항목: 성명, 연락처, 생년월일 / 보유기간: 탈퇴 후 1년</div>
        </div>

        <label className="flex items-start gap-3 py-3 border-t border-[#1B4D2E]/8 cursor-pointer">
          <div onClick={() => setTermsChecked(v => !v)}
            className={`w-5 h-5 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center border-[1.5px] transition-all ${termsChecked ? 'bg-[#1B4D2E] border-[#1B4D2E] text-white' : 'bg-[#EAF3EA] border-[#1B4D2E]/30'}`}>
            {termsChecked && <span className="text-[11px]">✓</span>}
          </div>
          <span className="text-xs text-[#2A5A2A] leading-relaxed">이용약관 및 개인정보 수집에 동의합니다</span>
        </label>

        <label className="flex items-start gap-3 py-3 border-t border-[#1B4D2E]/8 cursor-pointer">
          <div onClick={() => setForm(f => ({ ...f, auto_rollover: !f.auto_rollover }))}
            className={`w-5 h-5 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center border-[1.5px] transition-all ${form.auto_rollover ? 'bg-[#1B4D2E] border-[#1B4D2E] text-white' : 'bg-[#EAF3EA] border-[#1B4D2E]/30'}`}>
            {form.auto_rollover && <span className="text-[11px]">✓</span>}
          </div>
          <span className="text-xs text-[#2A5A2A] leading-relaxed">월 자동 자리 유지에 동의합니다</span>
        </label>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-4 text-sm text-red-700">{error}</div>}

        <div className="mt-6">
          <button onClick={handleSubmit} disabled={loading} className="wta-btn-primary disabled:opacity-50">
            {loading ? '등록 중...' : '다음 → PIN 설정'}
          </button>
        </div>
      </div>
    </div>
  )
}
