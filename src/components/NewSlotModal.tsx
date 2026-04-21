'use client'
// 주간 스케줄에서 "+ 신규 수업" 등록용 모달
// ✅ 스케줄등록 페이지(/owner/lesson-plan) 와 동일한 /api/lesson-plans 엔드포인트 사용
//   - 프로그램 기반 자동 금액 계산
//   - 가족 멤버(family_member_id) 지원
//   - 정원 / 코치 휴무 서버측 검증
//   - 단일 schedule 로 전송 (schedules: [{ datetime, duration }])
import { useEffect, useState } from 'react'

interface Coach { id: string; name: string }
interface Member { id: string; name: string; phone?: string }
interface FamilyMember { id: string; name: string }
interface Month { id: string; year: number; month: number }
interface Program {
  id: string
  name: string
  unit_minutes: number
  coach_id: string | null
  max_students?: number
}

export default function NewSlotModal({
  onClose,
  onDone,
  isMobile,
}: {
  onClose: () => void
  onDone: () => void
  isMobile: boolean
}) {
  const [coaches,      setCoaches]      = useState<Coach[]>([])
  const [members,      setMembers]      = useState<Member[]>([])
  const [months,       setMonths]       = useState<Month[]>([])
  const [allPrograms,  setAllPrograms]  = useState<Program[]>([])
  const [families,     setFamilies]     = useState<FamilyMember[]>([])

  const todayKst = () => {
    const d = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    return d.toISOString().split('T')[0]
  }

  const [coachId,      setCoachId]      = useState('')
  const [memberId,     setMemberId]     = useState('')
  const [memberQ,      setMemberQ]      = useState('')
  const [familyId,     setFamilyId]     = useState('')
  const [programId,    setProgramId]    = useState('')
  const [lessonType,   setLessonType]   = useState('개인레슨')
  const [date,         setDate]         = useState(todayKst())
  const [time,         setTime]         = useState('10:00')
  const [duration,     setDuration]     = useState(60)
  const [payment,      setPayment]      = useState<'unpaid' | 'paid'>('unpaid')
  const [busy,         setBusy]         = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // 최초 로드
  useEffect(() => {
    Promise.all([
      fetch('/api/coaches').then(r => r.json()),
      fetch('/api/members').then(r => r.json()),
      fetch('/api/months').then(r => r.json()),
      fetch('/api/programs').then(r => r.json()),
    ]).then(([c, m, mo, p]) => {
      setCoaches(Array.isArray(c) ? c : [])
      setMembers(Array.isArray(m) ? m : [])
      setMonths(Array.isArray(mo) ? mo : [])
      setAllPrograms(Array.isArray(p) ? p : [])
    })
  }, [])

  // 회원 선택 시 family 조회
  useEffect(() => {
    if (!memberId) { setFamilies([]); setFamilyId(''); return }
    fetch('/api/family/by-account?account_id=' + memberId)
      .then(r => r.json())
      .then(d => setFamilies(Array.isArray(d) ? d : []))
      .catch(() => setFamilies([]))
  }, [memberId])

  // 코치 변경 시 해당 코치 지정 프로그램도 가져오기 (공통 + 코치 지정)
  const [coachPrograms, setCoachPrograms] = useState<Program[]>([])
  useEffect(() => {
    if (!coachId) { setCoachPrograms([]); return }
    fetch(`/api/programs?coach_id=${coachId}`)
      .then(r => r.json())
      .then(d => setCoachPrograms(Array.isArray(d) ? d : []))
      .catch(() => setCoachPrograms([]))
  }, [coachId])

  const visiblePrograms = [
    ...allPrograms.filter(p => p.coach_id === null),
    ...coachPrograms.filter(p => p.coach_id === coachId),
  ]
  const selectedProgram = visiblePrograms.find(p => p.id === programId)

  // 프로그램 선택 시 unit_minutes 자동 채움
  useEffect(() => {
    if (selectedProgram?.unit_minutes) setDuration(selectedProgram.unit_minutes)
  }, [programId, selectedProgram?.unit_minutes])

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

    const [yy, mm] = date.split('-').map(Number)
    const month = months.find(m => m.year === yy && m.month === mm)
    if (!month) {
      setError(`${yy}년 ${mm}월 Month 레코드가 없습니다. 시스템 설정에서 먼저 생성하세요`)
      return
    }

    const scheduled_at = `${date}T${time}:00+09:00`

    setBusy(true)
    const res = await fetch('/api/lesson-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id:        memberId,
        coach_id:         coachId,
        month_id:         month.id,
        lesson_type:      lessonType || '개인레슨',
        unit_minutes:     duration,
        schedules:        [{ datetime: scheduled_at, duration }],
        amount:           0, // 프로그램 선택 시 서버가 재계산
        payment_status:   payment,
        ...(programId ? { program_id: programId } : {}),
        ...(familyId  ? { family_member_id: familyId } : {}),
        billing_count:    1, // 단일 슬롯
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
          width: isMobile ? '100%' : '480px',
          maxHeight: isMobile ? '92vh' : '88vh',
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
          <div style={{ padding:'0.5rem 0.75rem', background:'#fef2f2', color:'#b91c1c', borderRadius:8, fontSize:'0.8rem', marginBottom:'0.75rem', whiteSpace:'pre-wrap' }}>
            {error}
          </div>
        )}

        {/* 코치 */}
        <div style={{ marginBottom:'0.75rem' }}>
          <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#374151', marginBottom:'0.25rem' }}>코치</label>
          <select value={coachId} onChange={e => { setCoachId(e.target.value); setProgramId('') }}
            style={{ width:'100%', padding:'0.5rem 0.625rem', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:'0.85rem', background:'white' }}>
            <option value="">선택</option>
            {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* 회원 */}
        <div style={{ marginBottom:'0.75rem' }}>
          <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#374151', marginBottom:'0.25rem' }}>회원</label>
          {selectedMember ? (
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.5rem 0.625rem', border:'1.5px solid #16A34A', background:'#f0fdf4', borderRadius:8 }}>
              <span style={{ flex:1, fontSize:'0.85rem', fontWeight:600, color:'#111827' }}>{selectedMember.name}</span>
              {selectedMember.phone && <span style={{ fontSize:'0.7rem', color:'#6b7280' }}>{selectedMember.phone}</span>}
              <button onClick={() => { setMemberId(''); setMemberQ(''); setFamilyId('') }}
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

        {/* 가족 (회원 선택 + 자녀 있을 때만) */}
        {memberId && families.length > 0 && (
          <div style={{ marginBottom:'0.75rem' }}>
            <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#374151', marginBottom:'0.25rem' }}>
              수강자 <span style={{ fontWeight:400, color:'#9ca3af' }}>(선택: 자녀)</span>
            </label>
            <select value={familyId} onChange={e => setFamilyId(e.target.value)}
              style={{ width:'100%', padding:'0.5rem 0.625rem', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:'0.85rem', background:'white' }}>
              <option value="">본인</option>
              {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {/* 프로그램 (코치 선택 시만 활성) */}
        {coachId && visiblePrograms.length > 0 && (
          <div style={{ marginBottom:'0.75rem' }}>
            <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#374151', marginBottom:'0.25rem' }}>
              프로그램 <span style={{ fontWeight:400, color:'#9ca3af' }}>(선택 시 레슨비 자동 계산)</span>
            </label>
            <select value={programId} onChange={e => setProgramId(e.target.value)}
              style={{ width:'100%', padding:'0.5rem 0.625rem', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:'0.85rem', background:'white' }}>
              <option value="">선택 안 함 (금액 0원)</option>
              {visiblePrograms.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.unit_minutes}분{p.max_students && p.max_students > 1 ? `, 최대 ${p.max_students}명` : ''})
                </option>
              ))}
            </select>
          </div>
        )}

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
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', marginBottom:'0.75rem' }}>
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

        {/* 결제 상태 */}
        <div style={{ marginBottom:'1rem' }}>
          <label style={{ display:'block', fontSize:'0.75rem', fontWeight:700, color:'#374151', marginBottom:'0.25rem' }}>결제 상태</label>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <button type="button" onClick={() => setPayment('unpaid')}
              style={{ flex:1, padding:'0.5rem', borderRadius:8, border:'1.5px solid ' + (payment === 'unpaid' ? '#b91c1c' : '#e5e7eb'),
                       background: payment === 'unpaid' ? '#fef2f2' : 'white', color: payment === 'unpaid' ? '#b91c1c' : '#6b7280',
                       fontSize:'0.8rem', fontWeight: payment === 'unpaid' ? 700 : 400, cursor:'pointer' }}>
              미납
            </button>
            <button type="button" onClick={() => setPayment('paid')}
              style={{ flex:1, padding:'0.5rem', borderRadius:8, border:'1.5px solid ' + (payment === 'paid' ? '#16A34A' : '#e5e7eb'),
                       background: payment === 'paid' ? '#f0fdf4' : 'white', color: payment === 'paid' ? '#15803d' : '#6b7280',
                       fontSize:'0.8rem', fontWeight: payment === 'paid' ? 700 : 400, cursor:'pointer' }}>
              완납
            </button>
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
          코치 휴무·정원 초과·시간 충돌은 서버에서 자동 검증됩니다
        </div>
      </div>
    </div>
  )
}
