'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Plan {
  id: string
  payment_status: string
  amount: number
  lesson_type: string
  member: { name: string }
  coach: { name: string }
  month: { year: number; month: number }
}

interface Receipt {
  id: string
  image_url: string
  amount: number | null
  memo: string | null
  created_at: string
  uploader: { name: string }
}

export default function ReceiptsPage() {
  const [plans,    setPlans]    = useState<Plan[]>([])
  const [selected, setSelected] = useState<Plan | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [preview,  setPreview]  = useState<string>('')
  const [amount,   setAmount]   = useState('')
  const [memo,     setMemo]     = useState('')

  useEffect(() => {
    fetch('/api/payment').then(r => r.json()).then(d => {
      setPlans(Array.isArray(d) ? d : [])
      setLoading(false)
    })
  }, [])

  const loadReceipts = async (planId: string) => {
    const res = await fetch(`/api/receipts?plan_id=${planId}`)
    const data = await res.json()
    setReceipts(Array.isArray(data) ? data : [])
  }

  const handleSelectPlan = (plan: Plan) => {
    setSelected(plan)
    setPreview('')
    setAmount(String(plan.amount || ''))
    setMemo('')
    loadReceipts(plan.id)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!selected || !preview) return alert('영수증 이미지를 선택해주세요')
    setSaving(true)
    const res = await fetch('/api/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson_plan_id: selected.id, image_url: preview, amount: Number(amount) || null, memo }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); return alert(d.error) }
    setPreview('')
    setMemo('')
    loadReceipts(selected.id)
    // 플랜 상태 갱신
    setPlans(prev => prev.map(p => p.id === selected.id ? { ...p, payment_status: 'paid' } : p))
    setSelected(prev => prev ? { ...prev, payment_status: 'paid' } : prev)
  }

  const fmt = (n: number) => n?.toLocaleString('ko-KR')

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/payment" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>영수증 관리</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', maxWidth: '900px', margin: '0 auto', padding: '1.5rem', gap: '1rem' }}>

        {/* 납부 목록 */}
        <div>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.75rem' }}>납부 목록</div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {plans.map(p => (
                <div key={p.id} onClick={() => handleSelectPlan(p)}
                  style={{ background: 'white', border: `1.5px solid ${selected?.id === p.id ? '#f59e0b' : '#f3f4f6'}`, borderRadius: '1rem', padding: '1rem', cursor: 'pointer', boxShadow: selected?.id === p.id ? '0 0 0 2px #fde68a' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{p.member?.name}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: p.payment_status === 'paid' ? '#dcfce7' : '#fee2e2', color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                      {p.payment_status === 'paid' ? '완납' : '미납'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{p.month?.year}년 {p.month?.month}월 · {p.lesson_type}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginTop: '4px' }}>{fmt(p.amount)}원</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 영수증 첨부 */}
        {selected && (
          <div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#6b7280', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{selected.member?.name} - {selected.month?.year}년 {selected.month?.month}월</div>
            <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>영수증 이미지</label>
                  <label style={{ display: 'block', border: '2px dashed #e5e7eb', borderRadius: '0.875rem', padding: '1.5rem', textAlign: 'center', cursor: 'pointer', background: '#f9fafb' }}>
                    {preview ? (
                      <img src={preview} alt="영수증" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '0.5rem', objectFit: 'contain' }} />
                    ) : (
                      <div>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>이미지를 선택하세요</div>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                  </label>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>결제 금액</label>
                  <input className="input-base" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>메모</label>
                  <input className="input-base" placeholder="카드, 현금 등" value={memo} onChange={e => setMemo(e.target.value)} />
                </div>
                <button onClick={handleSubmit} disabled={saving} style={{ padding: '0.875rem', borderRadius: '0.75rem', border: 'none', background: '#92400e', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {saving ? '등록 중...' : '✅ 납부 완료 처리'}
                </button>
              </div>
            </div>

            {/* 기존 영수증 */}
            {receipts.length > 0 && (
              <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}>등록된 영수증</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {receipts.map(r => (
                    <div key={r.id} style={{ display: 'flex', gap: '0.875rem', alignItems: 'center', padding: '0.75rem', background: '#f9fafb', borderRadius: '0.75rem' }}>
                      <img src={r.image_url} alt="영수증" style={{ width: '60px', height: '60px', borderRadius: '0.5rem', objectFit: 'cover', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111827' }}>{r.amount ? `${fmt(r.amount)}원` : '-'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{r.uploader?.name} · {new Date(r.created_at).toLocaleDateString('ko-KR')}</div>
                        {r.memo && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{r.memo}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
