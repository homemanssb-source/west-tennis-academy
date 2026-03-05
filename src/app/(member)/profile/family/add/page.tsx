'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/ui/TopBar'

const DAYS = ['mon','tue','wed','thu','fri','sat','sun']
const DAY_LABELS: Record<string, string> = {
  mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일',
}
const TIMES = ['06:00','07:00','08:00','09:00','10:00','11:00','17:00','18:00','19:00','20:00']

export default function AddFamilyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    name: '', display_name: '', gender: '', birth_date: '',
    tennis_career: '', coach_id: '', lesson_type: 'individual',
    preferred_days: [] as string[], preferred_times: [] as string[],
    notes: '', auto_rollover: true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id, name').eq('role', 'coach').eq('is_active', true)
      .then(({ data }) => setCoaches(data ?? []))
  }, [])

  function toggleDay(d: string) {
    setForm(f => ({ ...f, preferred_days: f.preferred_days.includes(d) ? f.preferred_days.filter(x => x !== d) : [...f.preferred_days, d] }))
  }
  function toggleTime(t: string) {
    setForm(f => ({ ...f, preferred_times: f.preferred_times.includes(t) ? f.preferred_times.filter(x => x !== t) : [...f.preferred_times, t] }))
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError('이름을 입력해 주세요.'); return }
    if (!form.coach_id) { setError('담당 코치를 선택해 주세요.'); return }
    if (form.preferred_days.length === 0) { setError('희망 요일을 선택해 주세요.'); return }
    if (form.preferred_times.length === 0) { setError('희망 시간을 선택해 주세요.'); return }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/home')
    } catch (e: any) {
      setError(e.message ?? '추가에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="가족 추가" showBack />

      <div className="flex-1 px-4 pt-4 pb-16 space-y-4">
        <h2 className="font-serif text-xl font-semibold text-[#0F2010]">가족 구성원 추가</h2>
        <p className="text-sm text-[#5A8A5A]">자녀, 배우자 등 함께 레슨받는 가족을 추가하세요</p>

        <div className="wta-section-label"><span className="opacity-40">//</span> 기본 정보</div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">실명 <span className="text-[#C85A1E]">*</span></label>
            <input className="wta-input" placeholder="홍길동" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">표시 이름 (탭에 표시)</label>
            <input className="wta-input" placeholder="예: 첫째, 딸, 아들" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">성별</label>
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

        <div className="wta-section-label"><span className="opacity-40">//</span> 레슨 설정</div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-[#5A8A5A] tracking-[1px] uppercase mb-2">담당 코치 <span className="text-[#C85A1E]">*</span></label>
            <select className="wta-input" value={form.coach_id} onChange={e => setForm(f => ({ ...f, coach_id: e.target.value }))}>
              <option value="">코치 선택</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
            </select>
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
            <textarea className="wta-input resize-none" rows={2} placeholder="특이사항"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <label className="flex items-start gap-3 py-3 border-t border-[#1B4D2E]/8 cursor-pointer">
          <div onClick={() => setForm(f => ({ ...f, auto_rollover: !f.auto_rollover }))}
            className={`w-5 h-5 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center border-[1.5px] transition-all ${form.auto_rollover ? 'bg-[#1B4D2E] border-[#1B4D2E] text-white' : 'bg-[#EAF3EA] border-[#1B4D2E]/30'}`}>
            {form.auto_rollover && <span className="text-[11px]">✓</span>}
          </div>
          <span className="text-xs text-[#2A5A2A] leading-relaxed">월 자동 자리 유지에 동의합니다</span>
        </label>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        <button onClick={handleSubmit} disabled={loading} className="wta-btn-primary disabled:opacity-50">
          {loading ? '추가 중...' : '👨‍👩‍👧 가족 구성원 추가'}
        </button>
      </div>
    </div>
  )
}
