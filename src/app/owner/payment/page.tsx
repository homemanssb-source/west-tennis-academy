'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

interface LessonPlan {
  id: string
  payment_status: 'unpaid' | 'paid'
  amount: number
  lesson_type: string
  total_count: number
  completed_count: number
  unit_minutes: number
  member: { id: string; name: string; phone: string }
  coach:  { id: string; name: string }
  month:  { id: string; year: number; month: number }
}

interface Month  { id: string; year: number; month: number }
interface Member { id: string; name: string }
interface Coach  { id: string; name: string }

export default function PaymentPage() {
  const [plans,   setPlans]   = useState<LessonPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<'all'|'unpaid'|'paid'>('all')
  const [selected, setSelected] = useState<LessonPlan | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  const [showExtra, setShowExtra] = useState(false)
  const [months,  setMonths]  = useState<Month[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])

  // 회원 검색
  const [memberSearch, setMemberSearch] = useState('')
  const [showMemberDrop, setShowMemberDrop] = useState(false)
  const memberSearchRef = useRef<HTMLDivElement>(null)

  const [extraForm, setExtraForm] = useState({
    member_id: '', member_name: '', coach_id: '', month_id: '',
    lesson_type: '추가수업', unit_minutes: 60,
    scheduled_date: '', scheduled_time: '', amount: 0,
  })

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/payment')
    const d = await res.json()
    setPlans(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/months').then(r => r.json()).then(d => setMonths(Array.isArray(d) ? d : []))
    fetch('/api/members').then(r => r.json()).then(d => setMembers(Array.isArray(d) ? d : []))
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
  }, [])

  // 외부 클릭시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (memberSearchRef.current && !memberSearchRef.current.contains(e.target as Node)) {
        setShowMemberDrop(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceipt(file)
    const reader = new FileReader()
    reader.onload = ev => setReceiptPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handlePay = async () => {
    if (!selected) return
    setSaving(true)
    const fd = new FormData()
    fd.append('payment_status', 'paid')
    fd.append('amount', String(selected.amount))
    if (receipt) fd.append('receipt', receipt)
    await fetch(`/api/payment/${selected.id}`, { method: 'PATCH', body: fd })
    setSaving(false)
    setSelected(null)
    setReceipt(null)
    setReceiptPreview(null)
    load()
  }

  const handleUnpay = async () => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/payment/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: 'unpaid' }),
    })
    setSaving(false)
    setSelected(null)
    load()
  }

  const handleExtraSubmit = async () => {
    const { member_id, coach_id, month_id, lesson_type, unit_minutes, scheduled_date, scheduled_time, amount } = extraForm
    if (!member_id || !coach_id || !month_id || !scheduled_date || !scheduled_time) {
      alert('모든 항목을 입력해주세요')
      return
    }
    setSaving(true)
    const scheduled_at = `${scheduled_date}T${scheduled_time}:00+09:00`
    const res = await fetch('/api/lesson-plans/extra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id, coach_id, month_id, lesson_type, unit_minutes, scheduled_at, amount }),
    })
    const d = await res.json()
    setSaving(false)
    if (d.ok) {
      setShowExtra(false)
      setExtraForm({ member_id: '', member_name: '', coach_id: '', month_id: '', lesson_type: '추가수업', unit_minutes: 60, scheduled_date: '', scheduled_time: '', amount: 0 })
      setMemberSearch('')
      load()
    } else {
      alert(d.error || '오류 발생')
    }
  }

  const filtered = filter === 'all' ? plans : plans.filter(p => p.payment_status === filter)
  const fmt = (n: number) => n?.toLocaleString('ko-KR')

  const inputStyle = {
    width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb',
    borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif',
    background: 'white', boxSizing: 'border-box' as const, outline: 'none',
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>납부 관리</h1>
          <button onClick={() => setShowExtra(true)}
            style={{ padding: '0.5rem 1rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
            + 추가수업
          </button>
        </div>
        <div style={{ maxWidth: '900px', margin: '0.75rem auto 0', display: 'flex', gap: '0.5rem' }}>
          {(['all','unpaid','paid'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '0.375rem 0.875rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                background: filter === f ? '#16A34A' : '#f3f4f6',
                color: filter === f ? 'white' : '#6b7280' }}>
              {f === 'all' ? '전체' : f === 'unpaid' ? '미납' : '납부'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem 1.5rem 2rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>데이터가 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map(p => (
              <div key={p.id} onClick={() => setSelected(p)}
                style={{ background: 'white', border: `1.5px solid ${p.payment_status === 'paid' ? '#86efac' : '#fecaca'}`, borderRadius: '1rem', padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#111827' }}>{p.member?.name}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px',
                      background: p.payment_status === 'paid' ? '#dcfce7' : '#fee2e2',
                      color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                      {p.payment_status === 'paid' ? '납부' : '미납'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    {p.month?.year}년 {p.month?.month}월 · {p.coach?.name} · {p.lesson_type}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    {p.total_count}회 ({p.completed_count}완료) · {p.unit_minutes}분
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                    {fmt(p.amount)}원
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 납부 처리 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setReceipt(null); setReceiptPreview(null) } }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>납부 처리</h2>

            <div style={{ background: '#f9fafb', borderRadius: '0.875rem', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{selected.member?.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                {selected.month?.year}년 {selected.month?.month}월 · {selected.coach?.name} · {selected.lesson_type}
              </div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginTop: '0.5rem' }}>
                {fmt(selected.amount)}원
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>금액 수정</label>
              <input type="number" value={selected.amount}
                onChange={e => setSelected({ ...selected, amount: Number(e.target.value) })}
                style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>영수증 첨부 (납부 처리 시)</label>
              <label style={{ display: 'block', border: '2px dashed #e5e7eb', borderRadius: '0.875rem', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: receiptPreview ? '#f0fdf4' : '#fafafa' }}>
                <input type="file" accept="image/*,application/pdf" onChange={handleReceiptChange} style={{ display: 'none' }} />
                {receiptPreview ? (
                  <div>
                    <img src={receiptPreview} alt="영수증" style={{ maxHeight: '150px', maxWidth: '100%', borderRadius: '0.5rem', marginBottom: '6px' }} />
                    <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 700 }}>✓ {receipt?.name}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '2rem', marginBottom: '6px' }}>📎</div>
                    <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>이미지 또는 PDF 선택</div>
                  </div>
                )}
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.625rem' }}>
              {selected.payment_status === 'unpaid' ? (
                <button onClick={handlePay} disabled={saving}
                  style={{ flex: 1, padding: '0.875rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {saving ? '처리중...' : '✓ 납부 처리'}
                </button>
              ) : (
                <button onClick={handleUnpay} disabled={saving}
                  style={{ flex: 1, padding: '0.875rem', background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {saving ? '처리중...' : '↩ 미납으로 변경'}
                </button>
              )}
              <button onClick={() => { setSelected(null); setReceipt(null); setReceiptPreview(null) }}
                style={{ padding: '0.875rem 1.25rem', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 추가수업 생성 모달 */}
      {showExtra && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setShowExtra(false) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>+ 추가수업 등록</h2>

            {/* 회원 검색 */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>회원 검색</label>
              <div ref={memberSearchRef} style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: extraForm.member_id ? '2.5rem' : '0.75rem' }}
                  placeholder="이름으로 검색..."
                  value={memberSearch}
                  onChange={e => {
                    setMemberSearch(e.target.value)
                    setExtraForm(f => ({ ...f, member_id: '', member_name: '' }))
                    setShowMemberDrop(true)
                  }}
                  onFocus={() => setShowMemberDrop(true)}
                />
                {extraForm.member_id && (
                  <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#16A34A' }}>✓</span>
                )}
                {showMemberDrop && memberSearch && filteredMembers.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '180px', overflowY: 'auto', marginTop: '2px',
                  }}>
                    {filteredMembers.map(m => (
                      <div key={m.id}
                        onMouseDown={() => {
                          setExtraForm(f => ({ ...f, member_id: m.id, member_name: m.name }))
                          setMemberSearch(m.name)
                          setShowMemberDrop(false)
                        }}
                        style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', fontSize: '0.875rem', color: '#111827', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
                        {m.name}
                      </div>
                    ))}
                  </div>
                )}
                {showMemberDrop && memberSearch && filteredMembers.length === 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', padding: '0.75rem', fontSize: '0.875rem', color: '#9ca3af', marginTop: '2px' }}>
                    검색 결과 없음
                  </div>
                )}
              </div>
            </div>

            {/* 코치 */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>코치</label>
              <select value={extraForm.coach_id} onChange={e => setExtraForm(f => ({ ...f, coach_id: e.target.value }))} style={inputStyle}>
                <option value="">선택</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
              </select>
            </div>

            {/* 수업월 */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업월</label>
              <select value={extraForm.month_id} onChange={e => setExtraForm(f => ({ ...f, month_id: e.target.value }))} style={inputStyle}>
                <option value="">선택</option>
                {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
              </select>
            </div>

            {/* 레슨 유형 */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 유형</label>
              <input value={extraForm.lesson_type} onChange={e => setExtraForm(f => ({ ...f, lesson_type: e.target.value }))} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업시간(분)</label>
                <input type="number" value={extraForm.unit_minutes} onChange={e => setExtraForm(f => ({ ...f, unit_minutes: Number(e.target.value) }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>금액(원)</label>
                <input type="number" value={extraForm.amount} onChange={e => setExtraForm(f => ({ ...f, amount: Number(e.target.value) }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 날짜</label>
                <input type="date" value={extraForm.scheduled_date} onChange={e => setExtraForm(f => ({ ...f, scheduled_date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 시간</label>
                <input type="time" value={extraForm.scheduled_time} onChange={e => setExtraForm(f => ({ ...f, scheduled_time: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={handleExtraSubmit} disabled={saving}
                style={{ flex: 1, padding: '0.875rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '생성중...' : '수업 등록'}
              </button>
              <button onClick={() => { setShowExtra(false); setMemberSearch('') }}
                style={{ padding: '0.875rem 1.25rem', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}