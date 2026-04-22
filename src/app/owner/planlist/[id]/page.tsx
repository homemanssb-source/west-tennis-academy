'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

interface Slot {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  is_makeup: boolean
  slot_type: string
  memo: string | null
}

interface Plan {
  id: string
  lesson_type: string
  unit_minutes: number
  total_count: number
  completed_count: number
  payment_status: 'unpaid' | 'paid'
  amount: number
  member: { id: string; name: string; phone: string }
  coach:  { id: string; name: string }
  month:  { id: string; year: number; month: number }
  slots:  Slot[]
}

interface Coach { id: string; name: string }
interface Month { id: string; year: number; month: number }

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  scheduled: { bg: '#f0fdf4', border: '#86efac', color: '#15803d', label: '예정' },
  completed: { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8', label: '완료' },
  absent:    { bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c', label: '결석' },
  makeup:    { bg: '#fdf4ff', border: '#d8b4fe', color: '#7e22ce', label: '보강' },
  cancelled: { bg: '#f9fafb', border: '#d1d5db', color: '#6b7280', label: '취소' },
}

const DAYS = ['일','월','화','수','목','금','토']

export default function LessonPlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [plan,    setPlan]    = useState<Plan | null>(null)
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [months,  setMonths]  = useState<Month[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [tab,     setTab]     = useState<'slots'|'edit'>('slots')

  // 수정 폼
  const [editLesson,  setEditLesson]  = useState('')
  const [editUnit,    setEditUnit]    = useState(60)
  const [editAmount,  setEditAmount]  = useState(0)
  const [editCoach,   setEditCoach]   = useState('')
  const [editMonth,   setEditMonth]   = useState('')
  const [editPayment, setEditPayment] = useState<'unpaid'|'paid'>('unpaid')

  // 슬롯 추가
  const [showAddSlot,    setShowAddSlot]    = useState(false)
  const [newSlotDate,    setNewSlotDate]    = useState('')
  const [newSlotTime,    setNewSlotTime]    = useState('09:00')
  const [newSlotDur,     setNewSlotDur]     = useState(60)
  const [addingSlot,     setAddingSlot]     = useState(false)

  // 슬롯 개별 시간 수정
  const [editSlotIdx, setEditSlotIdx] = useState<string|null>(null)
  const [editSlotTime, setEditSlotTime] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/lesson-plans/${id}`)
    const d = await res.json()
    setPlan(d)
    setEditLesson(d.lesson_type ?? '')
    setEditUnit(d.unit_minutes ?? 60)
    setEditAmount(d.amount ?? 0)
    setEditCoach(d.coach?.id ?? '')
    setEditMonth(d.month?.id ?? '')
    setEditPayment(d.payment_status ?? 'unpaid')
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
    fetch('/api/months').then(r => r.json()).then(d => setMonths(Array.isArray(d) ? d : []))
  }, [load])

  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/lesson-plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lesson_type: editLesson,
        unit_minutes: editUnit,
        amount: editAmount,
        coach_id: editCoach,
        month_id: editMonth,
        payment_status: editPayment,
      }),
    })
    setSaving(false)
    load()
    setTab('slots')
  }

  const handleDelete = async () => {
    if (!confirm('이 레슨 플랜과 모든 수업 슬롯을 삭제할까요? 되돌릴 수 없습니다.')) return
    setSaving(true)
    await fetch(`/api/lesson-plans/${id}`, { method: 'DELETE' })
    setSaving(false)
    router.replace('/owner/planlist') 
  }

  const handleAddSlot = async () => {
    if (!newSlotDate || !newSlotTime) return
    setAddingSlot(true)
    const scheduled_at = `${newSlotDate}T${newSlotTime}:00+09:00`
    const res = await fetch('/api/lesson-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lesson_plan_id: id,
        scheduled_at,
        duration_minutes: newSlotDur,
        status: 'scheduled',
      }),
    })
    setAddingSlot(false)
    if (res.ok) {
      setShowAddSlot(false)
      setNewSlotDate('')
      setNewSlotTime('09:00')
      load()
    } else {
      const d = await res.json()
      alert(d.error || '슬롯 추가 실패')
    }
  }

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('이 수업 슬롯을 삭제할까요?')) return
    await fetch(`/api/lesson-slots/${slotId}`, { method: 'DELETE' })
    load()
  }

  const handleSaveSlotTime = async (slot: Slot) => {
    const d = new Date(slot.scheduled_at)
    const [h, m] = editSlotTime.split(':').map(Number)
    d.setHours(h, m, 0, 0)
    const ymd = d.toISOString().split('T')[0]
    const newDt = `${ymd}T${editSlotTime}:00+09:00`
    await fetch(`/api/lesson-slots/${slot.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: newDt }),
    })
    setEditSlotIdx(null)
    load()
  }

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]}) ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const fmt = (n: number) => (n || 0).toLocaleString('ko-KR')

  const inputStyle = {
    width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb',
    borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif',
    color: '#111827', background: 'white', boxSizing: 'border-box' as const, outline: 'none',
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
  if (!plan)   return <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>플랜을 찾을 수 없습니다</div>

  const sortedSlots = [...(plan.slots ?? [])].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )
  const pct = plan.total_count > 0 ? Math.round(plan.completed_count / plan.total_count * 100) : 0

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner/planlist" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>
              {plan.member?.name} · {plan.month?.year}년 {plan.month?.month}월
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {plan.coach?.name} 코치 · {plan.lesson_type}
            </div>
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px',
            background: plan.payment_status === 'paid' ? '#dcfce7' : '#fee2e2',
            color: plan.payment_status === 'paid' ? '#15803d' : '#b91c1c' }}>
            {plan.payment_status === 'paid' ? '납부' : '미납'}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.25rem 1.5rem 3rem' }}>
        {/* 요약 카드 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              { label: '전체 수업', value: `${plan.total_count}회`, color: '#374151', bg: '#f9fafb' },
              { label: '완료', value: `${plan.completed_count}회`, color: '#1d4ed8', bg: '#eff6ff' },
              { label: '금액', value: `${fmt(plan.amount)}원`, color: plan.payment_status === 'paid' ? '#15803d' : '#b91c1c', bg: plan.payment_status === 'paid' ? '#f0fdf4' : '#fef2f2' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: '0.75rem', padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', color: s.color, fontWeight: 600, marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, height: '8px', background: '#f3f4f6', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#3b82f6', borderRadius: '9999px' }} />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', flexShrink: 0 }}>{pct}%</span>
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {(['slots', 'edit'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '0.625rem 1.25rem', borderRadius: '0.75rem',
                border: `1.5px solid ${tab === t ? '#16A34A' : '#e5e7eb'}`,
                background: tab === t ? '#f0fdf4' : 'white',
                color: tab === t ? '#16A34A' : '#6b7280',
                fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {t === 'slots' ? '수업 슬롯' : '플랜 수정'}
            </button>
          ))}
        </div>

        {/* 수업 슬롯 탭 */}
        {tab === 'slots' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {sortedSlots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>수업 슬롯이 없습니다</div>
            ) : sortedSlots.map((s, i) => {
              const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled
              const isEditing = editSlotIdx === s.id
              return (
                <div key={s.id} style={{
                  background: isEditing ? '#eff6ff' : st.bg,
                  border: `1.5px solid ${isEditing ? '#93c5fd' : st.border}`,
                  borderRadius: '0.875rem', padding: '0.75rem 1rem',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  contain: 'layout paint', // ✅ perf: 카드 외부 repaint 연쇄 차단
                }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', minWidth: '20px', flexShrink: 0 }}>{i+1}</span>
                  {isEditing ? (
                    <>
                      <span style={{ fontSize: '0.82rem', color: '#374151', flex: 1 }}>{fmtDt(s.scheduled_at).split(' ')[0]}</span>
                      <input type="time" value={editSlotTime} onChange={e => setEditSlotTime(e.target.value)} autoFocus
                        style={{ padding: '0.25rem 0.5rem', border: '1.5px solid #3b82f6', borderRadius: '0.5rem', fontSize: '0.82rem', width: '100px' }} />
                      <button onClick={() => handleSaveSlotTime(s)}
                        style={{ padding: '0.25rem 0.625rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}>저장</button>
                      <button onClick={() => setEditSlotIdx(null)}
                        style={{ padding: '0.25rem 0.5rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}>취소</button>
                    </>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                          {fmtDt(s.scheduled_at)} · {s.duration_minutes}분
                          {s.is_makeup && <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#fdf4ff', color: '#7e22ce', padding: '1px 6px', borderRadius: '9999px', fontWeight: 700 }}>보강</span>}
                        </div>
                        {s.memo && <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>📝 {s.memo}</div>}
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
                        background: `${st.border}55`, color: st.color, flexShrink: 0 }}>
                        {st.label}
                      </span>
                      {/* 수정 버튼 (예정 상태만) */}
                      {s.status === 'scheduled' && (
                        <button onClick={() => {
                          const d = new Date(s.scheduled_at)
                          setEditSlotTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`)
                          setEditSlotIdx(s.id)
                        }} style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px' }}>✏️</button>
                      )}
                      <button onClick={() => handleDeleteSlot(s.id)}
                        style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 2px' }}>✕</button>
                    </>
                  )}
                </div>
              )
            })}

            {/* 슬롯 추가 버튼 */}
            {!showAddSlot ? (
              <button onClick={() => setShowAddSlot(true)}
                style={{ padding: '0.75rem', borderRadius: '0.875rem', border: '2px dashed #d1d5db', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 700, fontSize: '0.875rem' }}>
                + 수업 슬롯 추가
              </button>
            ) : (
              <div style={{ background: 'white', borderRadius: '0.875rem', border: '1.5px solid #e5e7eb', padding: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#111827', marginBottom: '0.75rem', fontSize: '0.875rem' }}>새 수업 슬롯 추가</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '0.625rem' }}>
                  <input type="date" value={newSlotDate} onChange={e => setNewSlotDate(e.target.value)} style={inputStyle} />
                  <input type="time" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {[30,45,60,90].map(u => (
                    <button key={u} onClick={() => setNewSlotDur(u)}
                      style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.5rem',
                        border: `1.5px solid ${newSlotDur === u ? '#16A34A' : '#e5e7eb'}`,
                        background: newSlotDur === u ? '#f0fdf4' : 'white',
                        color: newSlotDur === u ? '#16A34A' : '#6b7280',
                        fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>
                      {u}분
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleAddSlot} disabled={addingSlot || !newSlotDate}
                    style={{ flex: 1, padding: '0.625rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {addingSlot ? '추가 중...' : '추가'}
                  </button>
                  <button onClick={() => setShowAddSlot(false)}
                    style={{ padding: '0.625rem 1rem', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '0.625rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 플랜 수정 탭 */}
        {tab === 'edit' && (
          <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>레슨 타입</label>
              <input style={inputStyle} value={editLesson} onChange={e => setEditLesson(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>코치</label>
              <select style={inputStyle} value={editCoach} onChange={e => setEditCoach(e.target.value)}>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 월</label>
              <select style={inputStyle} value={editMonth} onChange={e => setEditMonth(e.target.value)}>
                {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>수업 시간 (분)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[30,45,60,90].map(u => (
                  <button key={u} onClick={() => setEditUnit(u)}
                    style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.625rem',
                      border: `1.5px solid ${editUnit === u ? '#16A34A' : '#e5e7eb'}`,
                      background: editUnit === u ? '#f0fdf4' : 'white',
                      color: editUnit === u ? '#16A34A' : '#6b7280',
                      fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                    {u}분
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>금액 (원)</label>
              <input style={inputStyle} type="number" value={editAmount} onChange={e => setEditAmount(Number(e.target.value))} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>납부 상태</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['unpaid','paid'] as const).map(v => (
                  <button key={v} onClick={() => setEditPayment(v)}
                    style={{ flex: 1, padding: '0.625rem', borderRadius: '0.625rem',
                      border: `1.5px solid ${editPayment === v ? (v === 'paid' ? '#86efac' : '#fca5a5') : '#e5e7eb'}`,
                      background: editPayment === v ? (v === 'paid' ? '#f0fdf4' : '#fef2f2') : 'white',
                      color: editPayment === v ? (v === 'paid' ? '#15803d' : '#b91c1c') : '#6b7280',
                      fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem' }}>
                    {v === 'paid' ? '납부' : '미납'}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleSave} disabled={saving}
              style={{ padding: '0.875rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.95rem' }}>
              {saving ? '저장 중...' : '✅ 저장'}
            </button>

            <button onClick={handleDelete} disabled={saving}
              style={{ padding: '0.875rem', background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca', borderRadius: '0.875rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontSize: '0.875rem' }}>
              🗑️ 플랜 삭제 (슬롯 포함)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
