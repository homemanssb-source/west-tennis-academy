'use client'
// src/app/owner/members/[id]/page.tsx
// ✅ 회원별 할인 설정 UI 추가

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface MemberDetail {
  member: {
    id: string; name: string; phone: string; sinceDate: string
    discount_amount: number; discount_memo: string | null
    coach: { name: string } | null
  }
  stats: {
    totalLessons: number; completedLessons: number; absentLessons: number
    makeupLessons: number; attendanceRate: number; totalPaid: number; totalUnpaid: number
  }
  plans: any[]
  family: any[]
}

const DAYS = ['일','월','화','수','목','금','토']

export default function MemberDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const [data,    setData]    = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<'history'|'plans'>('history')
  const [tempPin, setTempPin] = useState('')

  // ✅ 할인 편집 상태
  const [discountEdit,   setDiscountEdit]   = useState(false)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountMemo,   setDiscountMemo]   = useState('')
  const [savingDiscount, setSavingDiscount] = useState(false)

  const load = () => {
    fetch(`/api/members/${id}`).then(r => r.json()).then(d => {
      setData(d)
      setDiscountAmount(d.member?.discount_amount ?? 0)
      setDiscountMemo(d.member?.discount_memo   ?? '')
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [id])

  const handleResetPin = async () => {
    if (!confirm('PIN을 초기화할까요? 새 임시 PIN이 자동 발급됩니다.\n회원이 로그인 후 새 PIN으로 변경해야 합니다.')) return
    const res    = await fetch(`/api/members/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset_pin' }) })
    const result = await res.json()
    if (result.temp_pin) setTempPin(result.temp_pin)
    else alert(result.error ?? '초기화 실패')
  }

  // ✅ 할인 저장
  const handleSaveDiscount = async () => {
    setSavingDiscount(true)
    const res = await fetch(`/api/members/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_discount', discount_amount: discountAmount, discount_memo: discountMemo }),
    })
    setSavingDiscount(false)
    if (!res.ok) { alert('저장 실패'); return }
    setDiscountEdit(false)
    load()
  }

  const fmt = (n: number) => (n ?? 0).toLocaleString('ko-KR')

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
  if (!data)   return <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>회원 정보 없음</div>

  const { member, stats, plans, family } = data

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: '#7e22ce', padding: '2rem 1.5rem 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/owner/members" style={{ color: 'rgba(255,255,255,.6)', textDecoration: 'none', fontSize: '0.875rem' }}>‹ 회원 목록</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.875rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>👤</div>
            <div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>{member.name}</div>
              <div style={{ color: 'rgba(255,255,255,.7)', fontSize: '0.8rem', marginTop: '2px' }}>
                {member.phone} · {member.sinceDate}부터
                {member.coach && ` · ${member.coach.name} 코치`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>
        {/* 통계 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: '총 수업', value: stats.totalLessons,     unit: '회', color: '#7e22ce', bg: '#fdf4ff' },
            { label: '완료',    value: stats.completedLessons, unit: '회', color: '#1d4ed8', bg: '#eff6ff' },
            { label: '출석률',  value: stats.attendanceRate,   unit: '%',  color: '#15803d', bg: '#f0fdf4' },
            { label: '미납',    value: stats.totalUnpaid,      unit: '원', color: '#b91c1c', bg: '#fef2f2' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: s.unit === '원' ? '1.25rem' : '1.75rem', fontWeight: 700, color: s.color }}>
                {s.unit === '원' ? fmt(s.value) : s.value}{s.unit !== '원' ? s.unit : ''}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: s.color, marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 납부 요약 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ background: '#f0fdf4', borderRadius: '1rem', border: '1.5px solid #86efac', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>총 완납액</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>{fmt(stats.totalPaid)}원</div>
          </div>
          <div style={{ background: '#fef2f2', borderRadius: '1rem', border: '1.5px solid #fecaca', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>미납액</div>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#b91c1c' }}>{fmt(stats.totalUnpaid)}원</div>
          </div>
        </div>

        {/* ✅ 할인 설정 카드 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>💸 할인 설정</div>
            {discountEdit ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => { setDiscountEdit(false); setDiscountAmount(member.discount_amount ?? 0); setDiscountMemo(member.discount_memo ?? '') }}
                  style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
                <button onClick={handleSaveDiscount} disabled={savingDiscount}
                  style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: 'none', background: savingDiscount ? '#e5e7eb' : '#7e22ce', color: savingDiscount ? '#9ca3af' : 'white', cursor: savingDiscount ? 'not-allowed' : 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>
                  {savingDiscount ? '저장 중...' : '저장'}
                </button>
              </div>
            ) : (
              <button onClick={() => setDiscountEdit(true)}
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: '1.5px solid #e9d5ff', background: '#fdf4ff', color: '#7e22ce', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>수정</button>
            )}
          </div>

          {discountEdit ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '4px' }}>할인 금액 (원)</label>
                <input type="number" min="0"
                  value={discountAmount || ''}
                  onChange={e => setDiscountAmount(Number(e.target.value))}
                  placeholder="0 (할인 없음)"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '4px' }}>할인 사유</label>
                <input type="text"
                  value={discountMemo}
                  onChange={e => setDiscountMemo(e.target.value)}
                  placeholder="예) 가족 할인, 지인 소개 등"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                ※ 저장 후 다음 달 플랜 복사/초안 생성 시 자동 반영됩니다.
              </div>
            </div>
          ) : (
            member.discount_amount > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: '#fdf4ff', border: '1.5px solid #e9d5ff', borderRadius: '0.75rem', padding: '0.625rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7e22ce', marginBottom: '2px' }}>할인 금액</div>
                  <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#7e22ce' }}>
                    −{fmt(member.discount_amount)}원
                  </div>
                </div>
                {member.discount_memo && (
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>"{member.discount_memo}"</div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>할인 없음</div>
            )
          )}
        </div>

        {/* 계정 관리 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '0.875rem', color: '#111827' }}>계정 관리</div>
          <button onClick={handleResetPin}
            style={{ width: '100%', padding: '0.875rem', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', textAlign: 'left', fontSize: '0.875rem' }}>
            🔑 PIN 초기화 (임시 PIN 발급)
          </button>
          {tempPin && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: '#fef9c3', borderRadius: '0.75rem', border: '1.5px solid #fde68a' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>임시 PIN 발급됨</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#78350f', letterSpacing: '0.1em' }}>{tempPin}</div>
              <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: '4px' }}>회원에게 전달 후 새 PIN으로 변경하도록 안내하세요.</div>
            </div>
          )}
        </div>

        {/* 가족 구성원 */}
        {family.length > 0 && (
          <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '0.875rem', color: '#111827' }}>가족 구성원</div>
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              {family.map((f: any) => (
                <div key={f.id} style={{ background: '#fdf4ff', border: '1.5px solid #e9d5ff', borderRadius: '0.75rem', padding: '0.5rem 0.875rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#7e22ce' }}>{f.name}</div>
                  {f.birth_date && <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{f.birth_date}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 탭 */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {([['history','수업 이력'], ['plans','레슨 플랜']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem', border: `1.5px solid ${tab === t ? '#7e22ce' : '#e5e7eb'}`, background: tab === t ? '#fdf4ff' : 'white', color: tab === t ? '#7e22ce' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {label}
            </button>
          ))}
        </div>

        {/* 수업 이력 탭 */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {plans.flatMap((p: any) => (p.slots ?? []).map((s: any) => ({ ...s, plan: p }))).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>수업 이력이 없습니다</div>
            ) : (
              plans.flatMap((p: any) =>
                (p.slots ?? []).map((s: any) => ({ ...s, plan: p }))
              ).sort((a: any, b: any) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
              .slice(0, 30)
              .map((s: any) => (
                <div key={s.id} style={{ background: 'white', borderRadius: '0.75rem', border: '1.5px solid #f3f4f6', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: s.status === 'completed' ? '#16A34A' : s.status === 'absent' ? '#ef4444' : '#9ca3af' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>{fmtDt(s.scheduled_at)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{s.plan.lesson_type} · {s.plan.coach?.name} 코치</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: s.status === 'completed' ? '#16A34A' : s.status === 'absent' ? '#ef4444' : '#6b7280' }}>
                    {s.status === 'completed' ? '완료' : s.status === 'absent' ? '결석' : s.status === 'scheduled' ? '예정' : s.status}
                    {s.is_makeup ? ' (보강)' : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 레슨 플랜 탭 */}
        {tab === 'plans' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {plans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>등록된 플랜이 없습니다</div>
            ) : (
              plans.map((p: any) => (
                <div key={p.id} style={{ background: 'white', borderRadius: '1rem', border: `1.5px solid ${p.payment_status === 'paid' ? '#86efac' : '#fecaca'}`, padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>
                        {p.month?.year}년 {p.month?.month}월
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>
                        {p.coach?.name} 코치 · {p.lesson_type} · {p.total_count}회
                      </div>
                      {/* ✅ 할인 표시 */}
                      {(p.discount_amount ?? 0) > 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#7e22ce', marginTop: '2px' }}>
                          할인 −{fmt(p.discount_amount)}원
                          {p.discount_memo && ` (${p.discount_memo})`}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
                        {fmt(p.amount)}원
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', marginTop: '4px', display: 'inline-block', background: p.payment_status === 'paid' ? '#dcfce7' : '#fee2e2', color: p.payment_status === 'paid' ? '#15803d' : '#b91c1c', fontFamily: 'Noto Sans KR, sans-serif' }}>
                        {p.payment_status === 'paid' ? '납부' : '미납'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}