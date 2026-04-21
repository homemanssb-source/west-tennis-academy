'use client'
// 주간 스케줄에서 "+ 신규 수업" 등록용 모달
// - 코치 / 회원 / 날짜 / 시간 / 소요시간 입력
// - 서버 /api/lesson-plans/extra 로 POST → 휴무/충돌 가드 자동 적용
import { useEffect, useState } from 'react'

interface Coach { id: string; name: string }
interface Member { id: string; name: string; phone?: string }
interface Month { id: string; year: number; month: number }

export default function NewSlotModal({
  onClose,
  onDone,
  isMobile,
}: {
  onClose: () => void
  onDone: () => void
  isMobile: boolean
}) {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [months,  setMonths]  = useState<Month[]>([])

  const todayKst = () => {
    const d = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    return d.toISOString().split('T')[0]
  }

  const [coachId,     setCoachId]     = useState('')
  const [memberId,    setMemberId]    = useState('')
  const [memberQ,     setMemberQ]     = useState('')
  const [date,        setDate]        = useState(todayKst())
  const [time,        setTime]        = useState('10:00')
  const [duration,    setDuration]    = useState(60)
  const [lessonType,  setLessonType]  = useState('개인레슨')
  const [busy,        setBusy]        = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/coaches').then(r => r.json()),
      fetch('/api/members').then(r => r.json()),
      fetch('/api/months').then(r => r.json()),
    ]).then(([c, m, mo]) => {
      setCoaches(Array.isArray(c) ? c : [])
      setMembers(Array.isArray(m) ? m : [])
      setMonths(Array.isArray(mo) ? mo : [])
    })
  }, [])

  const filteredMembers = memberQ.trim()
    ? members.filter(m =>
        m.name.toLowerCase().includes(memberQ.toLowerCase()) ||
        (m.phone ?? '').includes(memberQ.trim())
      ).slice(0, 30)
    : members.slice(0, 30)

  const selectedMember = members.find(m => m.id === memberId)

  async function handleSubmit() {
    setError(null)
    if (!coachId) { setError('코치를 선택하세요'); return }
    if (!memberId) { setError('회원을 선택하세요'); return }
    if (!date) { setError('날짜를 선택하세요'); return }
    if (!time) { setError('시간을 선택하세요'); return }

    // date (YYYY-MM-DD) → month_id 매핑
    const [yy, mm] = date.split('-').map(Number)
    const month = months.find(m => m.year === yy && m.month === mm)
    if (!month) {
      setError(`${yy}년 ${mm}월 Month 레코드가 없습니다. 시스템 설정에서 먼저 생성하세요`)
      return
    }

    const scheduled_at = `${date}T${time}:00+09:00`

    setBusy(true)
    const res = await fetch('/api/lesson-plans/extra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id:    memberId,
        coach_id:     coachId,
        month_id:     month.id,
        lesson_type:  lessonType,
        unit_minutes: duration,
        scheduled_at,
        amount:       0, // 금액은 추후 플랜 목록/결제에서 수동 지정
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? '등록 실패')
      return
    }
    onDone()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:100,
        display:'flex', alignItems:isMobile ? 'flex-end' : 'center', justifyContent:'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:'white',
          width: isMobile ? '100%' : '460px',
          maxHeight: isMobile ? '90vh' : '85vh',
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          padding:'1.25rem',
          overflowY:'auto',
          boxShadow:'0 -4px 16px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <h3 style={{ fontFamily:'Oswald,sans-serif', fontWeight:700, fontSize:'1.1rem', color:'#111827' }}>+ 신규 수업 등록</h3>
          <button onClick={onClose} style={{ border:'none', background:'#f3f4f6', width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:'1rem' }}>✕</button>
        </div>

        {error && (
          <div style={{ padding:'0.5rem 0.75rem', background:'#fef2f2', color:'#b91c1c', borderRadius:8, fontSize:'0.8rem', marginBottom:'0.75rem' }}>
            {error}
          </div>
        )}

        {/* 코치 */}
        <div style={{ marginBottom:'0.75rem' }}>
          <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#374151', marginBottom:'0.25rem' }}>코치</label>
          <select value={coachId} onChange={e => setCoachId(e.target.value)}
            style={{ width:'100%', padding:'0.5rem 0.625rem', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:'0.85rem', background:'white' }}>
            <option value="">선택</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* 회원 검색/선택 */}
        <div style={{ marginBottom:'0.75rem' }}>
          <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#374151', marginBottom:'0.25rem' }}>회원</label>
          {selectedMember ? (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.625rem', border:'1.5px solid #16A34A', background:'#f0fdf4', borderRadius:8 }}>
              <span style={{ flex:1, fontSize:'0.85rem', fontWeight:600, color:'#111827' }}>{selectedMember.name}</span>
              {selectedMember.phone && <span style={{ fontSize:'0.7rem', color:'#6b7280' }}>{selectedMember.phone}</span>}
              <button onClick={() => { setMemberId(''); setMemberQ('') }}
                style={{ border:'none', background:'transparent', color:'#6b7280', fontSize:'0.75rem', cursor:'pointer' }}>변경</button>
            </div>
          ) : (
            <>
              <input
                value={memberQ}
                onChange={e => setMemberQ(e.target.value)}
                placeholder="이름 또는 전화번호"
                style={{ width:'100%', padding:'0.5rem 0.625rem', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:'0.85rem', marginBottom:'0.25rem' }}
              />
              <div style={{ maxHeight:160, overflowY:'auto', border:'1px solid #f3f4f6', borderRadius:8 }}>
                {filteredMembers.length === 0 ? (
                  <div style={{ padding:'0.625rem', textAlign:'center', color:'#9ca3af', fontSize:'0.8rem' }}>회원 없음</div>
                ) : (
                  filteredMembers.map(m => (
                    <button key={m.id} onClick={() => setMemberId(m.id)}
                      style={{ width:'100%', textAlign:'left', padding:'0.45rem 0.625rem', border:'none', borderBottom:'1px solid #f3f4f6', background:'white', cursor:'pointer' }}>
                      <span style={{ fontSize:'0.85rem', fontWeight:600, color:'#111827' }}>{m.name}</span>
                      {m.phone && <span style={{ fontSize:'0.7rem', color:'#9ca3af', marginLeft:'0.5rem' }}>{m.phone}</span>}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* 날짜 + 시간 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', marginBottom:'0.75rem' }}>
          <div>
            <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#374151', marginBottom:'0.25rem' }}>날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width:'100%', padding:'0.5rem 0.625rem', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:'0.85rem' }} />
          </div>
          <div>
            <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#374151', marginBottom:'0.25rem' }}>시간</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} step={600}
              style={{ width:'100%', padding:'0.5rem 0.625rem', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:'0.85rem' }} />
          </div>
        </div>

        {/* 소요시간 + 레슨타입 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', marginBottom:'1rem' }}>
          <div>
            <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#374151', marginBottom:'0.25rem' }}>소요시간</label>
            <select value={duration} onChange={e => setDuration(Number(e.target.value))}
              style={{ width:'100%', padding:'0.5rem 0.625rem', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:'0.85rem', background:'white' }}>
              <option value={30}>30분</option>
              <option value={45}>45분</option>
              <option value={60}>60분</option>
              <option value={90}>90분</option>
              <option value={120}>120분</option>
            </select>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#374151', marginBottom:'0.25rem' }}>레슨</label>
            <select value={lessonType} onChange={e => setLessonType(e.target.value)}
              style={{ width:'100%', padding:'0.5rem 0.625rem', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:'0.85rem', background:'white' }}>
              <option value="개인레슨">개인레슨</option>
              <option value="그룹레슨">그룹레슨</option>
              <option value="추가수업">추가수업</option>
              <option value="보강">보강</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={busy || !coachId || !memberId}
          style={{
            width:'100%', padding:'0.75rem', borderRadius:10, border:'none',
            background: (busy || !coachId || !memberId) ? '#d1d5db' : '#16A34A',
            color:'white', fontSize:'0.95rem', fontWeight:700,
            cursor: (busy || !coachId || !memberId) ? 'not-allowed' : 'pointer',
          }}
        >{busy ? '등록 중...' : '등록'}</button>

        <div style={{ marginTop:'0.75rem', fontSize:'0.7rem', color:'#9ca3af', textAlign:'center' }}>
          휴무·시간 충돌은 서버에서 자동 검증됩니다
        </div>
      </div>
    </div>
  )
}
