'use client'
// src/app/owner/payment/page.tsx

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

interface Slot {
  id: string; scheduled_at: string; duration_minutes: number
  status: string; is_makeup: boolean
}
interface LessonPlan {
  id: string; payment_status: 'unpaid' | 'paid'; amount: number
  lesson_type: string; total_count: number; completed_count: number
  unit_minutes: number
  toss_paid: boolean
  member: { id: string; name: string; phone: string }
  coach:  { id: string; name: string }
  month:  { id: string; year: number; month: number }
  slots?: Slot[]
}
interface Month  { id: string; year: number; month: number }
interface Member { id: string; name: string; phone: string }
interface Coach  { id: string; name: string }

const DAYS = ['일','월','화','수','목','금','토']
const SLOT_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  scheduled: { bg: '#f0fdf4', border: '#86efac', color: '#15803d', label: '예정' },
  completed: { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8', label: '완료' },
  absent:    { bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c', label: '결석' },
  makeup:    { bg: '#fdf4ff', border: '#d8b4fe', color: '#7e22ce', label: '보강' },
  cancelled: { bg: '#f9fafb', border: '#d1d5db', color: '#6b7280', label: '취소' },
}

export default function PaymentPage() {
  const [plans,    setPlans]    = useState<LessonPlan[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'all'|'unpaid'|'paid'>('all')
  const [selected, setSelected] = useState<LessonPlan | null>(null)
  const [detailTab, setDetailTab] = useState<'slots'|'pay'>('slots')
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slots,    setSlots]    = useState<Slot[]>([])
  const [saving,   setSaving]   = useState(false)
  const [receipt,  setReceipt]  = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  // ✅ 문자열로 관리 → 0일 때 빈칸 표시 가능
  const [editAmountStr, setEditAmountStr] = useState('')
  const [showExtra,  setShowExtra]  = useState(false)
  const [months,   setMonths]   = useState<Month[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [coaches,  setCoaches]  = useState<Coach[]>([])
  const [memberSearch,   setMemberSearch]   = useState('')
  const [showMemberDrop, setShowMemberDrop] = useState(false)
  const memberRef = useRef<HTMLDivElement>(null)

  const [payLink,     setPayLink]     = useState<string | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkCopied,  setLinkCopied]  = useState(false)

  const [extraForm, setExtraForm] = useState({
    member_id: '', coach_id: '', month_id: '',
    lesson_type: '추가수업', unit_minutes: 60,
    scheduled_date: '', scheduled_time: '', amount: 0,
  })

  // ✅ 실제 금액은 문자열 → 숫자 변환해서 사용
  const editAmount = editAmountStr === '' ? 0 : Number(editAmountStr)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/payment')
    const d   = await res.json()
    setPlans(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/months').then(r => r.json()).then(d => setMonths(Array.isArray(d) ? d : []))
    fetch('/api/members').then(r => r.json()).then(d => setMembers(Array.isArray(d) ? d : []))
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) setShowMemberDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredMembers = memberSearch
    ? members.filter(m => m.name.includes(memberSearch) || (m.phone || '').includes(memberSearch))
    : members

  const openDetail = async (plan: LessonPlan) => {
    setSelected(plan)
    setEditAmountStr(plan.amount > 0 ? String(plan.amount) : '')
    setDetailTab('slots')
    setReceipt(null)
    setReceiptPreview(null)
    setPayLink(null)
    setLinkCopied(false)
    setSaving(false)       // ✅ 이전 saving 상태 초기화
    setLinkLoading(false)  // ✅ 이전 linkLoading 상태 초기화
    setSlotsLoading(true)
    const res = await fetch(`/api/lesson-plans/${plan.id}`)
    const d   = await res.json()
    setSlots(d.slots ?? [])
    setSlotsLoading(false)
  }

  const handlePay = async () => {
    if (!selected) return
    // ✅ 클로저 문제 방지 — state에서 직접 읽기
    const currentAmount = editAmountStr === '' ? 0 : Number(editAmountStr)
    setSaving(true)
    const fd = new FormData()
    fd.append('payment_status', 'paid')
    fd.append('amount', String(currentAmount))
    if (receipt) fd.append('receipt', receipt)
    await fetch(`/api/payment/${selected.id}`, { method: 'PATCH', body: fd })
    setSaving(false)
    setSelected(null)
    load()
  }

  const handleUnpay = async () => {
    if (!selected) return
    // ✅ 클로저 문제 방지 — state에서 직접 읽기
    const currentAmount = editAmountStr === '' ? 0 : Number(editAmountStr)

    if (selected.toss_paid) {
      const confirmed = confirm(
        '⚠️ 이 플랜은 토스페이먼츠로 결제가 완료된 플랜입니다.\n\n' +
        '미납으로 변경하면 실제 결제 내역과 불일치가 발생합니다.\n' +
        '환불이 필요한 경우 토스페이먼츠 대시보드에서 별도로 처리해주세요.\n\n' +
        '그래도 미납으로 변경하시겠습니까?'
      )
      if (!confirmed) return
    }

    setSaving(true)
    await fetch(`/api/payment/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: 'unpaid', amount: currentAmount }),
    })
    setSaving(false)
    setSelected(null)
    load()
  }

  const handleGeneratePayLink = async () => {
    if (!selected) return
    const currentAmount = editAmountStr === '' ? 0 : Number(editAmountStr)
    if (currentAmount <= 0) { alert('금액을 먼저 입력해주세요'); return }

    setLinkLoading(true)
    setPayLink(null)
    setLinkCopied(false)

    // ✅ 링크 생성 전 금액 먼저 DB 저장
    const saveRes = await fetch(`/api/payment/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: currentAmount }),
    })
    if (!saveRes.ok) {
      setLinkLoading(false)
      alert('금액 저장 실패')
      return
    }

    const res  = await fetch('/api/payment/toss', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: selected.id }),
    })
    const data = await res.json()
    setLinkLoading(false)
    if (!res.ok) { alert(data.error || '링크 생성 실패'); return }
    setPayLink(data.pay_url)
  }

  const handleCopyLink = () => {
    if (!payLink) return
    navigator.clipboard.writeText(payLink).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    })
  }

  const handleExtraSubmit = async () => {
    const { member_id, coach_id, month_id, lesson_type, unit_minutes, scheduled_date, scheduled_time, amount } = extraForm
    if (!member_id || !coach_id || !month_id || !scheduled_date || !scheduled_time) {
      alert('모든 항목을 입력해주세요'); return
    }
    setSaving(true)
    const scheduled_at = `${scheduled_date}T${scheduled_time}:00+09:00`
    const res = await fetch('/api/lesson-plans/extra', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id, coach_id, month_id, lesson_type, unit_minutes, scheduled_at, amount }),
    })
    const d = await res.json()
    setSaving(false)
    if (d.ok) {
      setShowExtra(false)
      setExtraForm({ member_id: '', coach_id: '', month_id: '', lesson_type: '추가수업', unit_minutes: 60, scheduled_date: '', scheduled_time: '', amount: 0 })
      setMemberSearch('')
      load()
    } else {
      alert(d.error || '오류 발생')
    }
  }

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const filtered       = filter === 'all' ? plans : plans.filter(p => p.payment_status === filter)
  const fmt            = (n: number) => (n || 0).toLocaleString('ko-KR')
  const sortedSlots    = [...slots].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  const actualTotal    = slots.filter(s => s.status !== 'cancelled').length
  const completedCount = slots.filter(s => s.status === 'completed').length
  const pct            = actualTotal > 0 ? Math.round(completedCount / actualTotal * 100) : 0
  const unpaidCount    = plans.filter(p => p.payment_status === 'unpaid').length
  const paidCount      = plans.filter(p => p.payment_status === 'paid').length
  const unpaidTotal    = plans.filter(p => p.payment_status === 'unpaid').reduce((s, p) => s + (p.amount || 0), 0)

  const inputStyle = {
    width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb',
    borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif',
    background: 'white', boxSizing: 'border-box' as const, outline: 'none', color: '#111827',
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>납부 관리</h1>
          <button onClick={() => { setShowExtra(true); setMemberSearch(''); setExtraForm(f => ({ ...f, member_id: '' })) }}
            style={{ padding: '0.5rem 1rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
            + 추가수업
          </button>
        </div>
        <div style={{ maxWidth: '900px', margin: '0.75rem auto 0', display: 'flex', gap: '0.5rem' }}>
          {(['all','unpaid','paid'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '0.375rem 0.875rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                background: filter === f ? '#16A34A' : '#f3f4f6',
                color:      filter === f ? 'white'   : '#6b7280' }}>
              {f === 'all' ? '전체' : f === 'unpaid' ? '미납' : '납부'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem 1.5rem 2rem' }}>
        {!loading && plans.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[
              { label: '전체 플랜',  value: plans.length,    unit: '건', color: '#374151', bg: '#f3f4f6' },
              { label: '미납',       value: unpaidCount,      unit: '건', color: '#b91c1c', bg: '#fee2e2' },
              { label: '납부완료',   value: paidCount,        unit: '건', color: '#15803d', bg: '#dcfce7' },
              { label: '미납 금액',  value: fmt(unpaidTotal), unit: '원', color: '#b91c1c', bg: '#fef2f2' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: '0.75rem', padding: '0.625rem 1rem', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}{s.unit}</div>
                <div style={{ fontSize: '0.7rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>데이터가 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map(p => {
              const pct2 = p.total_count > 0 ? Math.round(p.completed_count / p.total_count * 100) : 0
              return (
                <div key={p.id} onClick={() => openDetail(p)}
                  style={{ background: 'white', border: `1.5px solid ${p.payment_status === 'paid' ? '#86efac' : '#fecaca'}`,
                    borderRadius: '1rem', padding: '1rem 1.25rem', cursor: 'pointer', transition: 'box-shadow .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#111827' }}>{p.member?.name}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px',
                          background: p.payment_status === 'paid' ? '#dcfce7' : '#fee2e2',
                          color:      p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                          {p.payment_status === 'paid' ? '납부완료' : '미납'}
                        </span>
                        {p.toss_paid && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px', background: '#eff6ff', color: '#1d4ed8' }}>
                            💳 토스결제
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '6px' }}>
                        {p.month?.year}년 {p.month?.month}월 · {p.coach?.name} · {p.lesson_type}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ flex: 1, height: '5px', background: '#f3f4f6', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct2}%`, background: '#3b82f6', borderRadius: '9999px' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', flexShrink: 0 }}>
                          {p.completed_count}/{p.total_count}회
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '1.1rem',
                        color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                        {fmt(p.amount)}원
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>클릭 →</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 상세 모달 ── */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setReceipt(null); setReceiptPreview(null); setPayLink(null) } }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '520px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }} />

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
                  {selected.member?.name} · {selected.month?.year}년 {selected.month?.month}월
                </span>
                {selected.toss_paid && (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: '#eff6ff', color: '#1d4ed8' }}>
                    💳 토스결제
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                {selected.coach?.name} · {selected.lesson_type} · {selected.unit_minutes}분
              </div>
            </div>

            {/* 탭 */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {(['slots', 'pay'] as const).map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${detailTab === t ? '#16A34A' : '#e5e7eb'}`,
                    background: detailTab === t ? '#f0fdf4' : 'white',
                    color:      detailTab === t ? '#16A34A' : '#6b7280',
                    fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {t === 'slots' ? '📋 수업 목록' : '💳 납부 처리'}
                </button>
              ))}
            </div>

            {/* 수업 목록 탭 */}
            {detailTab === 'slots' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                  {[
                    { label: '전체 수업', value: actualTotal,    color: '#374151', bg: '#f9fafb' },
                    { label: '완료',      value: completedCount, color: '#1d4ed8', bg: '#eff6ff' },
                    { label: '진행률',    value: `${pct}%`,      color: '#15803d', bg: '#f0fdf4' },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: '0.75rem', padding: '0.625rem', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: '0.7rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {slotsLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>불러오는 중...</div>
                ) : sortedSlots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>수업 슬롯이 없습니다</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {sortedSlots.map((s, i) => {
                      const st = SLOT_STYLE[s.status] ?? SLOT_STYLE.scheduled
                      return (
                        <div key={s.id} style={{ background: st.bg, border: `1.5px solid ${st.border}`, borderRadius: '0.75rem', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', width: '20px', flexShrink: 0 }}>{i+1}</span>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{fmtDt(s.scheduled_at)}</span>
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: '8px' }}>{s.duration_minutes}분</span>
                            {s.is_makeup && <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#fdf4ff', color: '#7e22ce', padding: '1px 6px', borderRadius: '9999px', fontWeight: 700 }}>보강</span>}
                          </div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: `${st.border}55`, color: st.color, flexShrink: 0 }}>
                            {st.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div style={{ marginTop: '1rem' }}>
                  <button onClick={() => setDetailTab('pay')}
                    style={{ width: '100%', padding: '0.875rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.95rem' }}>
                    💳 납부 처리하러 가기
                  </button>
                </div>
              </>
            )}

            {/* 납부 처리 탭 */}
            {detailTab === 'pay' && (
              <>
                {/* 토스 결제 완료 경고 배너 */}
                {selected.toss_paid && (
                  <div style={{ background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: '0.875rem', padding: '0.875rem 1rem', marginBottom: '1rem', display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>💳</span>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af', marginBottom: '2px' }}>토스페이먼츠로 결제 완료된 플랜</div>
                      <div style={{ fontSize: '0.72rem', color: '#3b82f6', lineHeight: 1.5 }}>
                        이 플랜은 카드 결제가 완료되었습니다.<br/>
                        미납으로 변경 시 실제 결제 내역과 불일치가 발생합니다.<br/>
                        환불이 필요하면 토스페이먼츠 대시보드에서 별도 처리해주세요.
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ background: '#f9fafb', borderRadius: '0.875rem', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{selected.member?.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    {selected.month?.year}년 {selected.month?.month}월 · {selected.coach?.name} · {selected.lesson_type}
                  </div>
                  {/* ✅ 현재 설정된 금액 표시 */}
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: editAmount > 0 ? '#111827' : '#9ca3af', marginTop: '0.5rem' }}>
                    {editAmount > 0 ? `${fmt(editAmount)}원` : '금액 미설정'}
                  </div>
                </div>

                {/* 토스 결제 링크 생성 */}
                {selected.payment_status === 'unpaid' && (
                  <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '0.875rem', padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.625rem' }}>
                      📲 카톡 결제 링크 전송
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginBottom: '0.75rem' }}>
                      링크를 생성해서 회원에게 카톡으로 보내주세요.<br/>
                      회원이 링크를 클릭하면 바로 카드 결제를 할 수 있습니다.
                    </div>

                    {!payLink ? (
                      <button onClick={handleGeneratePayLink} disabled={linkLoading || editAmount <= 0}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: 'none',
                          background: linkLoading || editAmount <= 0 ? '#e5e7eb' : '#1d4ed8',
                          color: linkLoading || editAmount <= 0 ? '#9ca3af' : 'white',
                          fontWeight: 700, cursor: linkLoading || editAmount <= 0 ? 'not-allowed' : 'pointer',
                          fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem' }}>
                        {linkLoading ? '링크 생성 중...' : editAmount <= 0 ? '금액을 먼저 입력해주세요' : '🔗 결제 링크 생성'}
                      </button>
                    ) : (
                      <div>
                        <div style={{ background: 'white', border: '1.5px solid #bfdbfe', borderRadius: '0.625rem', padding: '0.625rem 0.875rem', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#374151', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                          {payLink}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={handleCopyLink}
                            style={{ flex: 1, padding: '0.625rem', borderRadius: '0.625rem', border: 'none',
                              background: linkCopied ? '#15803d' : '#1d4ed8',
                              color: 'white', fontWeight: 700, cursor: 'pointer',
                              fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.82rem' }}>
                            {linkCopied ? '✅ 복사됨!' : '📋 링크 복사'}
                          </button>
                          <button onClick={handleGeneratePayLink}
                            style={{ padding: '0.625rem 0.875rem', borderRadius: '0.625rem', border: '1.5px solid #bfdbfe',
                              background: 'white', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer',
                              fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.82rem' }}>
                            재생성
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ✅ 금액 수정 - 0이면 빈칸으로 표시 */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>
                    금액 수정
                    {editAmount <= 0 && <span style={{ color: '#ef4444', marginLeft: '6px' }}>← 금액을 입력해주세요</span>}
                  </label>
                  <input
                    type="number"
                    value={editAmountStr}
                    onChange={e => setEditAmountStr(e.target.value)}
                    placeholder="금액 입력 (원)"
                    style={{
                      width: '100%', padding: '0.5rem 0.75rem',
                      border: `1.5px solid ${editAmount <= 0 ? '#fca5a5' : '#e5e7eb'}`,
                      borderRadius: '0.625rem', fontSize: '0.875rem',
                      fontFamily: 'Noto Sans KR, sans-serif',
                      boxSizing: 'border-box' as const,
                      background: editAmount <= 0 ? '#fef2f2' : 'white',
                    }}
                  />
                </div>

                {/* 영수증 첨부 */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>영수증 첨부 (현장 납부 처리 시)</label>
                  <label style={{ display: 'block', border: '2px dashed #e5e7eb', borderRadius: '0.875rem', padding: '1rem', textAlign: 'center', cursor: 'pointer', background: receiptPreview ? '#f0fdf4' : '#fafafa' }}>
                    <input type="file" accept="image/*,application/pdf" onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setReceipt(file)
                      const reader = new FileReader()
                      reader.onload = ev => setReceiptPreview(ev.target?.result as string)
                      reader.readAsDataURL(file)
                    }} style={{ display: 'none' }} />
                    {receiptPreview ? (
                      <div>
                        <img src={receiptPreview} alt="영수증" style={{ maxHeight: '150px', maxWidth: '100%', borderRadius: '0.5rem', marginBottom: '6px' }} />
                        <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 700 }}>✅ {receipt?.name}</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '2rem', marginBottom: '6px' }}>🧾</div>
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>이미지 또는 PDF 첨부</div>
                      </div>
                    )}
                  </label>
                </div>

                {/* 버튼 */}
                <div style={{ display: 'flex', gap: '0.625rem' }}>
                  {selected.payment_status === 'unpaid' ? (
                    <button onClick={handlePay} disabled={saving || editAmount <= 0}
                      style={{ flex: 1, padding: '0.875rem',
                        background: saving || editAmount <= 0 ? '#e5e7eb' : '#16A34A',
                        color: saving || editAmount <= 0 ? '#9ca3af' : 'white',
                        border: 'none', borderRadius: '0.875rem', fontWeight: 700,
                        cursor: saving || editAmount <= 0 ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {saving ? '처리중...' : editAmount <= 0 ? '금액을 입력해주세요' : '✅ 현장 납부 완료 처리'}
                    </button>
                  ) : (
                    <button onClick={handleUnpay} disabled={saving}
                      style={{ flex: 1, padding: '0.875rem',
                        background: selected.toss_paid ? '#fef3c7' : '#fef2f2',
                        color:      selected.toss_paid ? '#92400e' : '#b91c1c',
                        border:     `1.5px solid ${selected.toss_paid ? '#fde68a' : '#fecaca'}`,
                        borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer',
                        fontSize: '0.9rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                      {saving ? '처리중...' : selected.toss_paid ? '⚠️ 미납으로 변경 (주의)' : '↩ 미납으로 변경'}
                    </button>
                  )}
                  <button onClick={() => { setSelected(null); setReceipt(null); setReceiptPreview(null); setPayLink(null) }}
                    style={{ padding: '0.875rem 1.25rem', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    닫기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 추가수업 모달 */}
      {showExtra && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowExtra(false); setMemberSearch('') } }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>+ 추가수업 등록</h2>

            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>회원 검색</label>
              <div ref={memberRef} style={{ position: 'relative' }}>
                <input style={{ ...inputStyle, paddingRight: extraForm.member_id ? '2.5rem' : '0.75rem' }}
                  placeholder="이름 또는 전화번호로 검색..."
                  value={memberSearch}
                  onChange={e => { setMemberSearch(e.target.value); setExtraForm(f => ({ ...f, member_id: '' })); setShowMemberDrop(true) }}
                  onFocus={() => setShowMemberDrop(true)} />
                {extraForm.member_id && <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#16A34A', fontWeight: 700 }}>✓</span>}
                {showMemberDrop && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: '200px', overflowY: 'auto', marginTop: '2px' }}>
                    {filteredMembers.length > 0 ? filteredMembers.map(m => (
                      <div key={m.id} onMouseDown={() => { setExtraForm(f => ({ ...f, member_id: m.id })); setMemberSearch(m.name); setShowMemberDrop(false) }}
                        style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', fontSize: '0.875rem', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        <span style={{ color: '#9ca3af', marginLeft: '0.5rem', fontSize: '0.8rem' }}>{m.phone}</span>
                      </div>
                    )) : (
                      <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#9ca3af' }}>검색 결과 없음</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {[
              { label: '코치',   options: coaches.map(c => ({ v: c.id, l: `${c.name} 코치` })), value: extraForm.coach_id, onChange: (v: string) => setExtraForm(f => ({ ...f, coach_id: v })) },
              { label: '수업월', options: months.map(m => ({ v: m.id, l: `${m.year}년 ${m.month}월` })), value: extraForm.month_id, onChange: (v: string) => setExtraForm(f => ({ ...f, month_id: v })) },
            ].map(field => (
              <div key={field.label} style={{ marginBottom: '0.875rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>{field.label}</label>
                <select style={inputStyle} value={field.value} onChange={e => field.onChange(e.target.value)}>
                  <option value="">선택해주세요</option>
                  {field.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>날짜</label>
                <input type="date" style={inputStyle} value={extraForm.scheduled_date} onChange={e => setExtraForm(f => ({ ...f, scheduled_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>시간</label>
                <input type="time" style={inputStyle} value={extraForm.scheduled_time} onChange={e => setExtraForm(f => ({ ...f, scheduled_time: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>금액 (원)</label>
              <input type="number" style={inputStyle} value={extraForm.amount || ''} onChange={e => setExtraForm(f => ({ ...f, amount: Number(e.target.value) }))} placeholder="금액 입력" />
            </div>

            <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem' }}>
              <button onClick={() => { setShowExtra(false); setMemberSearch('') }}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
              <button onClick={handleExtraSubmit} disabled={saving}
                style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: saving ? '#e5e7eb' : '#16A34A', color: saving ? '#9ca3af' : 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
