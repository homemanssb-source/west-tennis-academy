'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Slot {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  lesson_plan: { lesson_type: string; coach: { name: string } }
}

export default function MemberMakeupPage() {
  const [slots,    setSlots]    = useState<Slot[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Slot | null>(null)
  const [makeupDt, setMakeupDt] = useState('')
  const [makeupTime, setMakeupTime] = useState('09:00')
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(false)

  useEffect(() => {
    const now = new Date().toISOString()
    fetch('/api/my-schedule').then(r => r.json()).then(d => {
      const upcoming = (Array.isArray(d) ? d : []).filter((s: Slot) => {
        const slotDate = new Date(s.scheduled_at)
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0,0,0,0)
        return slotDate >= tomorrow && s.status === 'scheduled'
      })
      setSlots(upcoming)
      setLoading(false)
    })
  }, [])

  const handleBook = async () => {
    if (!selected || !makeupDt) return alert('보강 날짜를 선택해주세요')
    const makeupDatetime = `${makeupDt}T${makeupTime}:00+09:00`
    setSaving(true)
    const res = await fetch('/api/makeup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_slot_id: selected.id, makeup_datetime: makeupDatetime }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); return alert(d.error) }
    setDone(true)
    setSelected(null)
  }

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    const days = ['일','월','화','수','목','금','토']
    return `${d.getMonth()+1}/${d.getDate()}(${days[d.getDay()]}) ${d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}`
  }

  // 최소 날짜: 내일
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  return (
    <div className="mobile-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/member" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>보강 예약</h1>
      </div>

      <div style={{ flex: 1, padding: '1rem 1.25rem 6rem' }}>
        {done && (
          <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '0.875rem', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>✅</div>
            <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.875rem' }}>보강 예약 완료!</div>
          </div>
        )}

        <div style={{ background: '#fdf4ff', border: '1.5px solid #e9d5ff', borderRadius: '0.875rem', padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#7e22ce' }}>
          💡 수업 하루 전까지 보강 예약이 가능합니다. 변경할 수업을 선택 후 보강 날짜를 지정해주세요.
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : slots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
            <p style={{ fontSize: '0.875rem' }}>보강 예약 가능한 수업이 없습니다</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', marginBottom: '4px' }}>보강할 수업 선택</div>
            {slots.map(s => (
              <div key={s.id} onClick={() => setSelected(s)}
                style={{ background: selected?.id === s.id ? '#fdf4ff' : 'white', border: `1.5px solid ${selected?.id === s.id ? '#c084fc' : '#f3f4f6'}`, borderRadius: '1rem', padding: '1rem 1.25rem', cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{fmtDt(s.scheduled_at)}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>{s.lesson_plan?.lesson_type} · {s.lesson_plan?.coach?.name} 코치 · {s.duration_minutes}분</div>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <div style={{ marginTop: '1.25rem', background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1.25rem' }}>
            <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>보강 날짜 선택</div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>날짜</label>
                <input type="date" className="input-base" value={makeupDt} min={minDate} onChange={e => setMakeupDt(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>시간</label>
                <input type="time" className="input-base" value={makeupTime} onChange={e => setMakeupTime(e.target.value)} />
              </div>
            </div>
            <button onClick={handleBook} disabled={saving} style={{ width: '100%', marginTop: '1rem', padding: '0.875rem', borderRadius: '0.75rem', border: 'none', background: '#7e22ce', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {saving ? '예약 중...' : '보강 예약하기'}
            </button>
          </div>
        )}
      </div>

      <div className="bottom-nav">
        <Link href="/member" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>🏠</span><span>홈</span></Link>
        <Link href="/member/schedule" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>📅</span><span>스케줄</span></Link>
        <Link href="/member/makeup" className="bottom-nav-item active"><span style={{ fontSize: '1.25rem' }}>🔁</span><span>보강</span></Link>
        <Link href="/member/payment" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>💰</span><span>납부</span></Link>
        <Link href="/member/family" className="bottom-nav-item"><span style={{ fontSize: '1.25rem' }}>👨‍👩‍👧‍👦</span><span>가족</span></Link>
      </div>
    </div>
  )
}
