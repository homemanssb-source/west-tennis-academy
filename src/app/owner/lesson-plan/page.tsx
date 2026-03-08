'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Coach   { id: string; name: string }
interface Month   { id: string; year: number; month: number }
interface Member  { id: string; name: string; phone: string }
interface Program { id: string; name: string; unit_minutes: number }

export default function LessonPlanCreatePage() {
  const router = useRouter()

  const [coaches,  setCoaches]  = useState<Coach[]>([])
  const [months,   setMonths]   = useState<Month[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [saving,   setSaving]   = useState(false)

  const [memberId,    setMemberId]    = useState('')
  const [coachId,     setCoachId]     = useState('')
  const [monthId,     setMonthId]     = useState('')
  const [programId,   setProgramId]   = useState('')
  const [lessonType,  setLessonType]  = useState('')
  const [unitMinutes, setUnitMinutes] = useState(60)
  const [totalCount,  setTotalCount]  = useState(8)
  const [amount,      setAmount]      = useState(0)
  const [payment,     setPayment]     = useState<'unpaid'|'paid'>('unpaid')

  useEffect(() => {
    Promise.all([
      fetch('/api/coaches').then(r => r.json()),
      fetch('/api/months').then(r => r.json()),
      fetch('/api/members').then(r => r.json()),
      fetch('/api/programs').then(r => r.json()),
    ]).then(([c, m, mem, p]) => {
      setCoaches(Array.isArray(c) ? c : [])
      const mList = Array.isArray(m) ? m : []
      setMonths(mList)
      if (mList.length > 0) setMonthId(mList[0].id)
      setMembers(Array.isArray(mem) ? mem : [])
      setPrograms(Array.isArray(p) ? p : [])
    })
  }, [])

  const handleProgramSelect = (p: Program) => {
    setProgramId(p.id)
    setLessonType(p.name)
    setUnitMinutes(p.unit_minutes || 60)
  }

  const handleSubmit = async () => {
    if (!memberId || !coachId || !monthId) {
      alert('회원, 코치, 수업월을 선택해주세요'); return
    }
    setSaving(true)
    const res = await fetch('/api/lesson-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: memberId,
        coach_id: coachId,
        month_id: monthId,
        lesson_type: lessonType || '개인레슨',
        unit_minutes: unitMinutes,
        total_count: totalCount,
        completed_count: 0,
        amount,
        payment_status: payment,
      }),
    })
    const d = await res.json()
    setSaving(false)
    if (d.error) { alert('등록 실패: ' + d.error); return }
    alert('레슨 플랜이 등록되었습니다!')
    router.push('/owner/planlist')
  }

  const s = {
    input: { width: '100%', padding: '0.625rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: '0.625rem', fontSize: '0.875rem', fontFamily: 'Noto Sans KR, sans-serif', background: 'white', boxSizing: 'border-box' as const, outline: 'none', color: '#111827' },
    label: { fontSize: '0.75rem', fontWeight: 700 as const, color: '#6b7280', display: 'block' as const, marginBottom: '6px' },
    btn:   { padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer' as const, fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif' },
    btnOn: { padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #16A34A', background: '#f0fdf4', color: '#15803d', cursor: 'pointer' as const, fontSize: '0.8rem', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' },
    card:  { background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem', marginBottom: '1rem' },
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* 헤더 */}
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/owner" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827', flex: 1 }}>스케줄 등록</h1>
          <Link href="/owner/planlist" style={{ fontSize: '0.8rem', color: '#6b7280', textDecoration: 'none' }}>플랜 목록 →</Link>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem' }}>

        {/* 회원/코치/월 */}
        <div style={s.card}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>기본 정보</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={s.label}>회원 선택</label>
              <select style={s.input} value={memberId} onChange={e => setMemberId(e.target.value)}>
                <option value="">회원을 선택하세요</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>코치 선택</label>
              <select style={s.input} value={coachId} onChange={e => setCoachId(e.target.value)}>
                <option value="">코치를 선택하세요</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>수업 월</label>
              <select style={s.input} value={monthId} onChange={e => setMonthId(e.target.value)}>
                {months.map(m => <option key={m.id} value={m.id}>{m.year}년 {m.month}월</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 수업 설정 */}
        <div style={s.card}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>수업 설정</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={s.label}>프로그램</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {programs.map(p => (
                  <button key={p.id} onClick={() => handleProgramSelect(p)}
                    style={programId === p.id ? s.btnOn : s.btn}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={s.label}>수업 유형</label>
              <input style={s.input} value={lessonType} onChange={e => setLessonType(e.target.value)} placeholder="개인레슨" />
            </div>
            <div>
              <label style={s.label}>회당 시간</label>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {[30, 45, 60, 90].map(u => (
                  <button key={u} onClick={() => setUnitMinutes(u)}
                    style={{ ...(unitMinutes === u ? s.btnOn : s.btn), flex: 1 }}>{u}분</button>
                ))}
              </div>
            </div>
            <div>
              <label style={s.label}>총 수업 횟수</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button onClick={() => setTotalCount(c => Math.max(1, c - 1))} style={{ ...s.btn, padding: '0.375rem 0.875rem', fontSize: '1.1rem' }}>−</button>
                <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#16A34A', minWidth: '40px', textAlign: 'center' }}>{totalCount}</span>
                <button onClick={() => setTotalCount(c => c + 1)} style={{ ...s.btn, padding: '0.375rem 0.875rem', fontSize: '1.1rem' }}>+</button>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>회</span>
              </div>
            </div>
          </div>
        </div>

        {/* 결제 */}
        <div style={s.card}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>결제 정보</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={s.label}>수업료 (원)</label>
              <input
                type="number" style={s.input}
                value={amount || ''}
                onChange={e => setAmount(Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div>
              <label style={s.label}>결제 상태</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setPayment('unpaid')} style={{ ...(payment === 'unpaid' ? { ...s.btnOn, borderColor: '#fca5a5', background: '#fee2e2', color: '#b91c1c' } : s.btn), flex: 1 }}>미납</button>
                <button onClick={() => setPayment('paid')}   style={{ ...(payment === 'paid'   ? s.btnOn : s.btn), flex: 1 }}>납부</button>
              </div>
            </div>
          </div>
        </div>

        {/* 등록 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={saving || !memberId || !coachId || !monthId}
          style={{
            width: '100%', padding: '1rem', borderRadius: '0.875rem', border: 'none',
            fontWeight: 700, fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif',
            cursor: saving || !memberId || !coachId || !monthId ? 'not-allowed' : 'pointer',
            background: saving || !memberId || !coachId || !monthId ? '#e5e7eb' : '#16A34A',
            color: saving || !memberId || !coachId || !monthId ? '#9ca3af' : 'white',
          }}>
          {saving ? '등록 중...' : '스케줄 등록'}
        </button>
      </div>
    </div>
  )
}