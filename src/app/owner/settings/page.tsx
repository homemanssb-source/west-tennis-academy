'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Month  { id: string; year: number; month: number; start_date: string; end_date: string }
interface Staff  { id: string; name: string; phone: string; role: string; is_active: boolean; created_at: string }

const ROLE_LABEL: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  admin:   { label: '관리자',   emoji: '🛡️', color: '#15803d', bg: '#dcfce7' },
  coach:   { label: '코치',     emoji: '🎾', color: '#1d4ed8', bg: '#dbeafe' },
  payment: { label: '결제담당', emoji: '💳', color: '#92400e', bg: '#fde68a' },
}

export default function SettingsPage() {
  const [months, setMonths]     = useState<Month[]>([])
  const [staff,  setStaff]      = useState<Staff[]>([])
  const [loadingM, setLoadingM] = useState(true)
  const [loadingS, setLoadingS] = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [tempPin,  setTempPin]  = useState('')
  const [selected, setSelected] = useState<Staff | null>(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone,setEditPhone]= useState('')
  const [form, setForm]         = useState({ name: '', phone: '', role: 'admin' })

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const loadMonths = async () => {
    setLoadingM(true)
    const res = await fetch('/api/months')
    const data = await res.json()
    setMonths(Array.isArray(data) ? data : [])
    setLoadingM(false)
  }

  const loadStaff = async () => {
    setLoadingS(true)
    const res = await fetch('/api/staff')
    const data = await res.json()
    setStaff(Array.isArray(data) ? data : [])
    setLoadingS(false)
  }

  useEffect(() => { loadMonths(); loadStaff() }, [])

  const getMonthRange = (y: number, m: number) => {
    const start = new Date(y, m - 1, 1)
    const end   = new Date(y, m, 0)
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    return { start_date: fmt(start), end_date: fmt(end) }
  }

  const handleAddMonth = async () => {
    setSaving(true)
    const { start_date, end_date } = getMonthRange(year, month)
    const res = await fetch('/api/months', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, month, start_date, end_date }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return alert(data.error)
    loadMonths()
  }

  const handleAddStaff = async () => {
    if (!form.name || !form.phone) return alert('이름과 전화번호를 입력해주세요')
    setSaving(true)
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return alert(data.error)
    setTempPin(data.temp_pin)
    setForm({ name: '', phone: '', role: 'admin' })
    loadStaff()
  }

  const handleSaveStaff = async () => {
    if (!selected) return
    setSaving(true)
    await fetch(`/api/staff/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, phone: editPhone }),
    })
    setSaving(false)
    setSelected(null)
    loadStaff()
  }

  const handleResetPin = async (id: string) => {
    if (!confirm('PIN을 초기화할까요? 새 임시 PIN이 자동 발급됩니다.')) return
    const res = await fetch(`/api/staff/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset_pin' }),
    })
    const data = await res.json()
    if (data.temp_pin) setTempPin(data.temp_pin)
  }

  const handleToggle = async (id: string) => {
    await fetch(`/api/staff/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_active' }),
    })
    loadStaff()
    setSelected(null)
  }

  const handlePhone = (v: string, setter: (s: string) => void) => {
    const num = v.replace(/\D/g,'').slice(0,11)
    const fmt = num.length <= 3 ? num : num.length <= 7 ? `${num.slice(0,3)}-${num.slice(3)}` : `${num.slice(0,3)}-${num.slice(3,7)}-${num.slice(7)}`
    setter(fmt)
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>시스템 설정</h1>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* 스탭 관리 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>스탭 관리</h2>
            <button onClick={() => setShowAdd(true)} style={{ background: '#16A34A', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.375rem 0.875rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              + 추가
            </button>
          </div>

          {loadingS ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>불러오는 중...</div>
          : staff.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>등록된 스탭이 없습니다</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {staff.map(s => {
                const r = ROLE_LABEL[s.role] ?? { label: s.role, emoji: '👤', color: '#6b7280', bg: '#f3f4f6' }
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', background: '#f9fafb', borderRadius: '0.875rem', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{r.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.phone}</div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: r.bg, color: r.color }}>{r.label}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: s.is_active ? '#dcfce7' : '#fee2e2', color: s.is_active ? '#15803d' : '#b91c1c' }}>{s.is_active ? '활성' : '비활성'}</span>
                    <button onClick={() => { setSelected(s); setEditName(s.name); setEditPhone(s.phone) }}
                      style={{ color: '#16A34A', fontWeight: 700, fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>수정</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 수업월 등록 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업월 등록</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>연도</label>
              <input type="number" className="input-base" value={year} onChange={e => setYear(Number(e.target.value))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>월</label>
              <select className="input-base" value={month} onChange={e => setMonth(Number(e.target.value))}>
                {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
            </div>
            <button onClick={handleAddMonth} disabled={saving}
              style={{ padding: '0.75rem 1.25rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap' }}>
              {saving ? '추가 중' : '+ 추가'}
            </button>
          </div>
        </div>

        {/* 월 목록 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>등록된 수업월</h2>
          {loadingM ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>불러오는 중...</div>
          : months.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>등록된 월이 없습니다</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {months.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', background: '#f9fafb', borderRadius: '0.75rem' }}>
                  <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, color: '#16A34A', fontSize: '1rem', marginRight: '0.75rem' }}>{m.year}.{String(m.month).padStart(2,'0')}</span>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{m.start_date} ~ {m.end_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 스탭 추가 모달 */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdd(false) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>스탭 등록</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>역할</label>
                <select className="input-base" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="admin">🛡️ 관리자</option>
                  <option value="coach">🎾 코치</option>
                  <option value="payment">💳 결제담당</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>이름</label>
                <input className="input-base" placeholder="홍길동" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>전화번호</label>
                <input className="input-base" placeholder="010-0000-0000" value={form.phone} onChange={e => handlePhone(e.target.value, v => setForm(f => ({ ...f, phone: v })))} inputMode="numeric" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
              <button onClick={handleAddStaff} disabled={saving} style={{ flex: 2, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '등록 중...' : '등록 (임시 PIN 자동 발급)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스탭 수정 모달 */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '480px', borderRadius: '1.5rem 1.5rem 0 0', padding: '1.5rem' }}>
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0 auto 1.25rem' }}></div>
            <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>{selected.name} 수정</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>이름</label>
                <input className="input-base" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>전화번호</label>
                <input className="input-base" value={editPhone} onChange={e => handlePhone(e.target.value, setEditPhone)} inputMode="numeric" />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <button onClick={handleSaveStaff} disabled={saving} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => handleResetPin(selected.id)} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                🔑 PIN 초기화 (임시 PIN 자동 발급)
              </button>
              <button onClick={() => handleToggle(selected.id)} style={{ padding: '0.75rem', borderRadius: '0.75rem', border: `1.5px solid ${selected.is_active ? '#fecaca' : '#86efac'}`, background: selected.is_active ? '#fef2f2' : '#f0fdf4', color: selected.is_active ? '#b91c1c' : '#15803d', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {selected.is_active ? '🚫 비활성화' : '✅ 활성화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN 완료 모달 */}
      {tempPin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: 'white', borderRadius: '1.5rem', padding: '2rem', maxWidth: '320px', width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h3 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>완료!</h3>
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '1rem', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>임시 PIN</div>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '2rem', fontWeight: 700, color: '#16A34A', letterSpacing: '6px' }}>{tempPin}</div>
            </div>
            <button onClick={() => { setTempPin(''); setShowAdd(false) }}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}



===== app\owner\stats\page.tsx =====
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Month { id: string; year: number; month: number }
interface CoachStat {
  id: string; name: string
  planCount: number; totalCount: number; completedCount: number
  paidAmount: number; unpaidAmount: number
}
interface Stats {
  totalPaid: number; totalUnpaid: number
  totalSlots: number; doneSlots: number; planCount: number
  coachStats: CoachStat[]
}

export default function StatsPage() {
  const [months,   setMonths]   = useState<Month[]>([])
  const [monthId,  setMonthId]  = useState('')
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    fetch('/api/months').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : []
      setMonths(list)
      if (list.length > 0) setMonthId(list[0].id)
    })
  }, [])

  useEffect(() => {
    if (!monthId) return
    setLoading(true)
    fetch(`/api/stats/monthly?month_id=${monthId}`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
  }, [monthId])

  const fmt = (n: number) => (n || 0).toLocaleString('ko-KR')
  const selectedMonth = months.find(m => m.id === monthId)

  const cardStyle = (color: string) => ({
    background: 'white', borderRadius: '1rem', border: `1.5px solid ${color}`,
    padding: '1.25rem', flex: 1,
  })

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>월별 통계</h1>
          <select
            value={monthId}
            onChange={e => setMonthId(e.target.value)}
            style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', background: 'white' }}
          >
            {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : !stats ? null : (
          <>
            {/* 월 타이틀 */}
            {selectedMonth && (
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
                {selectedMonth.year}년 {selectedMonth.month}월
              </div>
            )}

            {/* 요약 카드 */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={cardStyle('#86efac')}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>납부 완료</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#15803d' }}>{fmt(stats.totalPaid)}원</div>
              </div>
              <div style={cardStyle('#fca5a5')}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>미납 합계</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#b91c1c' }}>{fmt(stats.totalUnpaid)}원</div>
              </div>
              <div style={cardStyle('#bfdbfe')}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '4px' }}>총 수업</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#1d4ed8' }}>{stats.doneSlots} / {stats.totalSlots}회</div>
              </div>
              <div style={cardStyle('#e9d5ff')}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', marginBottom: '4px' }}>등록 플랜</div>
                <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#7c3aed' }}>{stats.planCount}건</div>
              </div>
            </div>

            {/* 납부율 바 */}
            <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>납부율</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803d' }}>
                  {stats.totalPaid + stats.totalUnpaid > 0
                    ? Math.round(stats.totalPaid / (stats.totalPaid + stats.totalUnpaid) * 100)
                    : 0}%
                </span>
              </div>
              <div style={{ background: '#f3f4f6', borderRadius: '9999px', height: '10px', overflow: 'hidden' }}>
                <div style={{
                  background: '#16A34A', height: '100%', borderRadius: '9999px',
                  width: `${stats.totalPaid + stats.totalUnpaid > 0 ? Math.round(stats.totalPaid / (stats.totalPaid + stats.totalUnpaid) * 100) : 0}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.375rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>납부 {fmt(stats.totalPaid)}원</span>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>미납 {fmt(stats.totalUnpaid)}원</span>
              </div>
            </div>

            {/* 코치별 통계 */}
            <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>코치별 통계</h2>
              {stats.coachStats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: '0.875rem' }}>데이터 없음</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {stats.coachStats.map(c => (
                    <div key={c.id} style={{ background: '#f9fafb', borderRadius: '0.875rem', padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.625rem' }}>
                        <span style={{ fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>{c.name} 코치</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#6b7280' }}>플랜 {c.planCount}건</span>
                      </div>
                      {/* 수업 완료 바 */}
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>수업 완료율</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#374151' }}>
                            {c.completedCount}/{c.totalCount}회 ({c.totalCount > 0 ? Math.round(c.completedCount / c.totalCount * 100) : 0}%)
                          </span>
                        </div>
                        <div style={{ background: '#e5e7eb', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                          <div style={{
                            background: '#3b82f6', height: '100%', borderRadius: '9999px',
                            width: `${c.totalCount > 0 ? Math.round(c.completedCount / c.totalCount * 100) : 0}%`,
                          }} />
                        </div>
                      </div>
                      {/* 납부 현황 */}
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ flex: 1, background: '#dcfce7', borderRadius: '0.5rem', padding: '0.375rem 0.625rem' }}>
                          <div style={{ fontSize: '0.65rem', color: '#15803d', fontWeight: 700 }}>납부</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803d', fontFamily: 'Oswald, sans-serif' }}>{fmt(c.paidAmount)}원</div>
                        </div>
                        <div style={{ flex: 1, background: '#fee2e2', borderRadius: '0.5rem', padding: '0.375rem 0.625rem' }}>
                          <div style={{ fontSize: '0.65rem', color: '#b91c1c', fontWeight: 700 }}>미납</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#b91c1c', fontFamily: 'Oswald, sans-serif' }}>{fmt(c.unpaidAmount)}원</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}



===== app\owner\unregistered\page.tsx =====
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface UnregMember {
  id: string
  name: string
  phone: string
  coach: string | null
}

interface Data {
  unregistered: UnregMember[]
  thisMonth: { year: number; month: number }
  prevMonth: { year: number; month: number }
}

export default function UnregisteredPage() {
  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string>('')

  useEffect(() => {
    fetch('/api/unregistered').then(r => r.json()).then(d => { setData(d); setLoading(false) })
  }, [])

  const sendNotif = async (memberId: string, name: string) => {
    setSending(memberId)
    await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targets: [memberId],
        title: `📢 ${data?.thisMonth.year}년 ${data?.thisMonth.month}월 레슨 등록 안내`,
        body: `${name}님, 이번 달 레슨이 아직 등록되지 않았습니다. 확인 부탁드립니다.`,
        type: 'warning',
        link: '/member/schedule',
      }),
    })
    setSending('')
    alert(`${name}님에게 알림을 보냈습니다`)
  }

  const sendAll = async () => {
    if (!data?.unregistered.length) return
    if (!confirm(`${data.unregistered.length}명 전체에게 알림을 보낼까요?`)) return
    setSending('all')
    for (const m of data.unregistered) {
      await sendNotif(m.id, m.name)
    }
    setSending('')
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>‹</Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>미등록 회원 탐지</h1>
        {data && data.unregistered.length > 0 && (
          <button onClick={sendAll} disabled={sending === 'all'} style={{ marginLeft: 'auto', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '0.625rem', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            {sending === 'all' ? '발송 중...' : '📢 전체 알림'}
          </button>
        )}
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>
        {data && (
          <div style={{ background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: '1rem', padding: '1rem 1.25rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#854d0e', fontWeight: 600 }}>
            📅 {data.prevMonth.year}년 {data.prevMonth.month}월에 수업이 있었지만 {data.thisMonth.year}년 {data.thisMonth.month}월 레슨이 미등록된 회원입니다
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>불러오는 중...</div>
        ) : !data?.unregistered.length ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <div style={{ fontWeight: 700, color: '#15803d', fontSize: '1.1rem' }}>모든 회원이 등록되었습니다!</div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>이번 달 레슨 미등록 회원이 없습니다</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#b91c1c', marginBottom: '4px' }}>미등록 회원 {data.unregistered.length}명</div>
            {data.unregistered.map(m => (
              <div key={m.id} style={{ background: 'white', border: '1.5px solid #f3f4f6', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>{m.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                    {m.phone}{m.coach && ` · ${m.coach} 코치`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link href={`/owner/members/${m.id}`}
                    style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, fontSize: '0.75rem', textDecoration: 'none' }}>
                    상세
                  </Link>
                  <button onClick={() => sendNotif(m.id, m.name)} disabled={sending === m.id}
                    style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {sending === m.id ? '...' : '📢 알림'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}



===== app\owner\weekly\page.tsx =====
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Slot {
  id: string; scheduled_at: string; duration_minutes: number; status: string; is_makeup: boolean
  lesson_plan: { lesson_type: string; member: { id: string; name: string }; coach: { id: string; name: string } }
}
interface Block {
  id: string; coach_id: string; block_date: string | null
  block_start: string | null; block_end: string | null
  reason: string | null; repeat_weekly: boolean; day_of_week: number | null
}

const DAYS = ['월','화','수','목','금','토','일']
const START_HOUR = 8, END_HOUR = 22, CELL_MIN = 10, CELL_H = 18
const TOTAL_CELLS = ((END_HOUR - START_HOUR) * 60) / CELL_MIN
const STATUS_COLOR: Record<string,string> = { scheduled:'#16A34A', completed:'#1d4ed8', cancelled:'#b91c1c', makeup:'#7e22ce' }
const STATUS_BG: Record<string,string> = { scheduled:'#f0fdf4', completed:'#eff6ff', cancelled:'#fef2f2', makeup:'#fdf4ff' }
const COACH_COLORS = ['#16A34A','#2563eb','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#65a30d']

function getMonday(d: Date) {
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  mon.setHours(0, 0, 0, 0)
  return mon
}
function toYMD(d: Date) { const kst = new Date(d.getTime() + 9*60*60*1000); return kst.toISOString().split('T')[0] }

export default function WeeklySchedulePage() {
  const [monday, setMonday] = useState(() => getMonday(new Date()))
  const [slots, setSlots] = useState<Slot[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'all'|'byCoach'>('all')
  const [selCoach, setSelCoach] = useState<string>('all')
  const now = new Date()

  useEffect(() => {
    setLoading(true)
    fetch('/api/weekly-schedule?week=' + toYMD(monday))
      .then(r => r.json())
      .then(d => {
        setSlots(Array.isArray(d) ? d : (Array.isArray(d?.slots) ? d.slots : []))
        setBlocks(Array.isArray(d?.blocks) ? d.blocks : [])
        setLoading(false)
      })
  }, [monday])

  const changeWeek = (dir: number) => {
    const next = new Date(monday)
    next.setDate(next.getDate() + dir * 7)
    setMonday(next)
  }

  const weekEnd = new Date(monday)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekLabel = (monday.getMonth()+1) + '/' + monday.getDate() + ' ~ ' + (weekEnd.getMonth()+1) + '/' + weekEnd.getDate()
  const timeLabels = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)
  const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d })
  const coaches = Array.from(new Map(slots.filter(s => s.lesson_plan?.coach).map(s => [s.lesson_plan.coach.id, s.lesson_plan.coach])).values())
  const coachColorMap: Record<string,string> = {}
  coaches.forEach((c, i) => { coachColorMap[c.id] = COACH_COLORS[i % COACH_COLORS.length] })
  const filteredSlots = selCoach === 'all' ? slots : slots.filter(s => s.lesson_plan?.coach?.id === selCoach)

  function TimeGrid({ slotsForGrid, blocksForGrid }: { slotsForGrid: Slot[]; blocksForGrid: Block[] }) {
    return (
      <div style={{ display:'flex', minWidth:'700px' }}>
        <div style={{ width:'32px', flexShrink:0, marginTop:'40px' }}>
          <div style={{ position:'relative', height:TOTAL_CELLS*CELL_H }}>
            {timeLabels.map((h,i) => (
              <div key={h} style={{ position:'absolute', top:i*6*CELL_H-7, right:2, fontSize:'9px', color:'#9ca3af', fontFamily:'monospace', whiteSpace:'nowrap' }}>{String(h).padStart(2,'0')}</div>
            ))}
          </div>
        </div>
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
          {weekDates.map((date, di) => {
            const ymd = toYMD(date)
            const isToday = ymd === toYMD(now)
            const dow = date.getDay()
            const daySlots = slotsForGrid.filter(s => s.scheduled_at.startsWith(ymd))
            // 해당 날짜의 휴무 블록 (일회성 + 반복)
            const dayBlocks = blocksForGrid.filter(b =>
              b.repeat_weekly ? b.day_of_week === dow : b.block_date === ymd
            )
            const nowMin = isToday ? (now.getHours()-START_HOUR)*60+now.getMinutes() : -1
            return (
              <div key={di} style={{ display:'flex', flexDirection:'column' }}>
                <div style={{ textAlign:'center', height:'40px', background:isToday?'#16A34A':'white', border:'1.5px solid '+(isToday?'#16A34A':'#e5e7eb'), borderRadius:'8px 8px 0 0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ fontFamily:'Oswald,sans-serif', fontWeight:700, fontSize:'0.8rem', color:isToday?'white':dow===0?'#ef4444':dow===6?'#3b82f6':'#374151' }}>{DAYS[di]}</div>
                  <div style={{ fontSize:'0.65rem', color:isToday?'rgba(255,255,255,0.8)':'#9ca3af' }}>{date.getMonth()+1}/{date.getDate()}</div>
                </div>
                <div style={{ position:'relative', height:TOTAL_CELLS*CELL_H, background:'white', border:'1px solid #e5e7eb', borderTop:'none', borderRadius:'0 0 8px 8px', overflow:'hidden' }}>
                  {Array.from({ length:TOTAL_CELLS }, (_,i) => (
                    <div key={i} style={{ position:'absolute', left:0, right:0, top:i*CELL_H, height:CELL_H, borderBottom:i%6===5?'1px solid #e5e7eb':'1px solid #f3f4f6', background:i%6===0?'#fafafa':'transparent' }} />
                  ))}
                  {isToday && nowMin>=0 && nowMin<=(END_HOUR-START_HOUR)*60 && (
                    <div style={{ position:'absolute', left:0, right:0, top:(nowMin/CELL_MIN)*CELL_H, borderTop:'2px solid #ef4444', zIndex:10, display:'flex', alignItems:'center' }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:'#ef4444', marginTop:-3, marginLeft:-1, flexShrink:0 }} />
                    </div>
                  )}
                  {/* 코치 휴무 블록 */}
                  {dayBlocks.map(b => {
                    const startMin = b.block_start
                      ? (Number(b.block_start.split(':')[0])*60 + Number(b.block_start.split(':')[1])) - START_HOUR*60
                      : 0
                    const endMin = b.block_end
                      ? (Number(b.block_end.split(':')[0])*60 + Number(b.block_end.split(':')[1])) - START_HOUR*60
                      : (END_HOUR - START_HOUR)*60
                    const top  = Math.max(0, startMin/CELL_MIN*CELL_H)
                    const height = Math.max(CELL_H, (endMin - startMin)/CELL_MIN*CELL_H)
                    return (
                      <div key={b.id} style={{ position:'absolute', top:top+1, left:0, right:0, height:height-1, background:'repeating-linear-gradient(45deg,#f3f0ff,#f3f0ff 4px,#ede9fe 4px,#ede9fe 8px)', borderLeft:'3px solid #7c3aed', zIndex:4, overflow:'hidden', padding:'2px 3px' }}>
                        <div style={{ fontSize:'8px', fontWeight:700, color:'#7c3aed', lineHeight:1.3 }}>휴무</div>
                        {height>=32 && b.reason && <div style={{ fontSize:'8px', color:'#5b21b6', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.reason}</div>}
                      </div>
                    )
                  })}
                  {daySlots.map(slot => {
                    const dt = new Date(slot.scheduled_at)
                    const startMin = (dt.getHours()-START_HOUR)*60+dt.getMinutes()
                    if (startMin < 0 || startMin >= (END_HOUR-START_HOUR)*60) return null
                    const dur = slot.duration_minutes || 30
                    const top = (startMin/CELL_MIN)*CELL_H
                    const height = Math.max((dur/CELL_MIN)*CELL_H, CELL_H*3)
                    const status = slot.is_makeup ? 'makeup' : slot.status
                    const coachId = slot.lesson_plan?.coach?.id
                    const color = viewMode==='byCoach' && coachId ? coachColorMap[coachId] : STATUS_COLOR[status] ?? STATUS_COLOR.scheduled
                    const bg = viewMode==='byCoach' && coachId ? coachColorMap[coachId]+'18' : STATUS_BG[status] ?? STATUS_BG.scheduled
                    return (
                      <div key={slot.id} style={{ position:'absolute', top:top+1, left:2, right:2, height:height-2, background:bg, borderLeft:'3px solid '+color, borderRadius:'0 4px 4px 0', padding:'2px 3px', zIndex:5, overflow:'hidden', boxShadow:'0 1px 2px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize:'9px', fontWeight:700, color, lineHeight:1.3 }}>{String(dt.getHours()).padStart(2,'0')}:{String(dt.getMinutes()).padStart(2,'0')}</div>
                        <div style={{ fontSize:'10px', fontWeight:700, color:'#111827', lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{slot.lesson_plan?.member?.name ?? '-'}</div>
                        {height>=42 && <div style={{ fontSize:'9px', color:'#6b7280', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{slot.lesson_plan?.coach?.name}</div>}
                        {slot.is_makeup && <div style={{ fontSize:'8px', background:'#e9d5ff', color:'#7e22ce', borderRadius:'9999px', padding:'0 4px', display:'inline-block', marginTop:'1px' }}>보강</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background:'#f9fafb', minHeight:'100vh' }}>
      <div style={{ background:'white', borderBottom:'1.5px solid #f3f4f6', padding:'0.875rem 1.25rem', position:'sticky', top:0, zIndex:40, display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
        <Link href='/owner' style={{ color:'#9ca3af', textDecoration:'none', fontSize:'1.25rem' }}>←</Link>
        <h1 style={{ fontFamily:'Oswald,sans-serif', fontSize:'1.25rem', fontWeight:700, color:'#111827' }}>주간 스케줄</h1>
        <div style={{ display:'flex', gap:'3px', background:'#f3f4f6', borderRadius:'0.625rem', padding:'3px' }}>
          <button onClick={() => { setViewMode('all'); setSelCoach('all') }} style={{ padding:'0.25rem 0.75rem', borderRadius:'0.5rem', border:'none', background:viewMode==='all'?'white':'transparent', color:viewMode==='all'?'#111827':'#9ca3af', fontWeight:viewMode==='all'?700:400, fontSize:'0.8rem', cursor:'pointer', whiteSpace:'nowrap' }}>전체 보기</button>
          <button onClick={() => { setViewMode('byCoach'); setSelCoach('all') }} style={{ padding:'0.25rem 0.75rem', borderRadius:'0.5rem', border:'none', background:viewMode==='byCoach'?'white':'transparent', color:viewMode==='byCoach'?'#111827':'#9ca3af', fontWeight:viewMode==='byCoach'?700:400, fontSize:'0.8rem', cursor:'pointer', whiteSpace:'nowrap' }}>선생님별</button>
        </div>
        {viewMode==='all' && coaches.length>0 && (
          <select value={selCoach} onChange={e => setSelCoach(e.target.value)} style={{ padding:'0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.625rem', background:'white', fontSize:'0.8rem', color:'#374151', cursor:'pointer' }}>
            <option value='all'>전체 코치</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
          </select>
        )}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <button onClick={() => changeWeek(-1)} style={{ padding:'0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.5rem', background:'white', cursor:'pointer' }}>◀</button>
          <span style={{ fontSize:'0.875rem', fontWeight:700, color:'#111827', whiteSpace:'nowrap' }}>{weekLabel}</span>
          <button onClick={() => changeWeek(1)} style={{ padding:'0.375rem 0.75rem', border:'1.5px solid #e5e7eb', borderRadius:'0.5rem', background:'white', cursor:'pointer' }}>▶</button>
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign:'center', padding:'4rem', color:'#9ca3af' }}>불러오는 중...</div>
      ) : (
        <div style={{ padding:'1rem' }}>
          {viewMode==='all' && (
            <><div style={{ display:'flex', gap:'1rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
              {[['scheduled','예정'],['completed','완료'],['cancelled','결석'],['makeup','보강']].map(([k,l]) => (
                <div key={k} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.75rem', color:'#6b7280' }}>
                  <div style={{ width:'10px', height:'10px', background:STATUS_COLOR[k], borderRadius:'2px' }}/>{l}
                </div>
              ))}
            </div>
            <div style={{ overflowX:'auto' }}><TimeGrid slotsForGrid={filteredSlots} blocksForGrid={blocks} /></div></>
          )}
          {viewMode==='byCoach' && (
            <>{coaches.length>0 && (
              <div style={{ display:'flex', gap:'1rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
                {coaches.map((c,i) => (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'0.75rem', color:'#374151', fontWeight:600 }}>
                    <div style={{ width:'10px', height:'10px', background:COACH_COLORS[i%COACH_COLORS.length], borderRadius:'50%' }}/>{c.name}
                  </div>
                ))}
              </div>
            )}
            {coaches.length===0 ? (
              <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>등록된 코치가 없습니다</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'2rem' }}>
                {coaches.map((coach,ci) => {
                  const coachSlots = slots.filter(s => s.lesson_plan?.coach?.id===coach.id)
                  const color = COACH_COLORS[ci%COACH_COLORS.length]
                  return (
                    <div key={coach.id}>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.625rem 1rem', background:'white', borderRadius:'0.75rem', border:'2px solid '+color, marginBottom:'0.5rem' }}>
                        <div style={{ width:12, height:12, borderRadius:'50%', background:color, flexShrink:0 }}/>
                        <span style={{ fontFamily:'Oswald,sans-serif', fontWeight:700, fontSize:'1rem', color:'#111827' }}>{coach.name} 코치</span>
                        <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'#6b7280' }}>이번 주 {coachSlots.length}건</span>
                      </div>
                      <div style={{ overflowX:'auto' }}><TimeGrid slotsForGrid={coachSlots} blocksForGrid={blocks.filter(b => b.coach_id === coach.id)} /></div>
                    </div>
                  )
                })}
              </div>
            )}</>
          )}
        </div>
      )}
    </div>
  )
}
