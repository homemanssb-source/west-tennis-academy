'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Profile  { id: string; name: string }
interface Month    { id: string; year: number; month: number }
interface Program  { id: string; name: string; ratio: string; max_students: number; unit_minutes: number }
interface FamilyMember { id: string; name: string; account_id: string }

const DAYS = ['??,'??,'??,'??,'紐?,'湲?,'??]

export default function LessonPlanPage() {
  const router = useRouter()
  const [members,  setMembers]  = useState<Profile[]>([])
  const [coaches,  setCoaches]  = useState<Profile[]>([])
  const [months,   setMonths]   = useState<Month[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [familyMap, setFamilyMap] = useState<Record<string, FamilyMember[]>>({})

  const [memberId,     setMemberId]     = useState('')
  const [familyId,     setFamilyId]     = useState('')
  const [coachId,      setCoachId]      = useState('')
  const [monthId,      setMonthId]      = useState('')
  const [programId,    setProgramId]    = useState('')
  const [lessonType,   setLessonType]   = useState('')
  const [unitMin,      setUnitMin]      = useState(60)
  const [amount,       setAmount]       = useState('')
  const [startDate,    setStartDate]    = useState('')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [time,         setTime]         = useState('09:00')
  const [count,        setCount]        = useState(8)
  const [schedules,    setSchedules]    = useState<{ datetime: string; duration: number }[]>([])
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    fetch('/api/members').then(r => r.json()).then(d => setMembers(Array.isArray(d) ? d : []))
    fetch('/api/coaches').then(r => r.json()).then(d => setCoaches(Array.isArray(d) ? d : []))
    fetch('/api/months').then(r => r.json()).then(d => setMonths(Array.isArray(d) ? d : []))
    fetch('/api/programs').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d.filter((p: Program) => p) : []
      setPrograms(list)
      // 1:1 ?꾨줈洹몃옩???덉쑝硫??먮룞 ?좏깮
      const oneOnOne = list.find((p: Program) => p.ratio === '1:1')
      if (oneOnOne) {
        setProgramId(oneOnOne.id)
        setLessonType(oneOnOne.name)
        setUnitMin(oneOnOne.unit_minutes)
      }
    })
  }, [])

  // ?뚯썝 ?좏깮 ??媛議?援ъ꽦??議고쉶
  const handleMemberChange = async (id: string) => {
    setMemberId(id)
    setFamilyId('')
    if (!id) return
    if (familyMap[id]) return
    const res = await fetch(`/api/family/by-account?account_id=${id}`)
    const data = await res.json()
    setFamilyMap(prev => ({ ...prev, [id]: Array.isArray(data) ? data : [] }))
  }

  // ?꾨줈洹몃옩 ?좏깮 ???먮룞 ?ㅼ젙
  const handleProgramChange = (id: string) => {
    setProgramId(id)
    const prog = programs.find(p => p.id === id)
    if (prog) {
      setLessonType(prog.name)
      setUnitMin(prog.unit_minutes)
    }
  }

  const generateSchedules = () => {
    if (!startDate || !selectedDays.length || !count) return
    const result: { datetime: string; duration: number }[] = []
    const cur = new Date(startDate)
    let cnt = 0
    while (cnt < count) {
      if (selectedDays.includes(cur.getDay())) {
        const dt = `${cur.toISOString().split('T')[0]}T${time}:00+09:00`
        result.push({ datetime: dt, duration: unitMin })
        cnt++
      }
      cur.setDate(cur.getDate() + 1)
    }
    setSchedules(result)
  }

  const handleSubmit = async () => {
    setError('')
    if (!memberId || !coachId || !monthId) return setError('?뚯썝, 肄붿튂, ?섏뾽?붿쓣 ?좏깮?댁＜?몄슂')
    if (!schedules.length) return setError('?섏뾽 ?쇱젙???앹꽦?댁＜?몄슂')

    setSaving(true)
    const res = await fetch('/api/lesson-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id:  memberId,
        family_member_id: familyId || null,
        coach_id:   coachId,
        month_id:   monthId,
        program_id: programId || null,
        lesson_type: lessonType,
        unit_minutes: unitMin,
        schedules,
        amount: Number(amount) || 0,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setError(data.error)
    router.replace('/owner/schedule')
  }

  const toggleDay = (d: number) => setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  const removeSlot = (i: number) => setSchedules(prev => prev.filter((_, idx) => idx !== i))

  const fmtDt = (dt: string) => {
    const d = new Date(dt)
    return `${d.getMonth()+1}/${d.getDate()}(${DAYS[d.getDay()]}) ${d.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}`
  }

  const currentFamily = familyMap[memberId] ?? []

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ background: 'white', borderBottom: '1.5px solid #f3f4f6', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <Link href="/admin" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '1.25rem' }}>??/Link>
        <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>?덉뒯 ?뚮옖 ?깅줉</h1>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* 湲곕낯 ?뺣낫 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>湲곕낯 ?뺣낫</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?섏뾽 ?꾨줈洹몃옩</label>
              <select className="input-base" value={programId} onChange={e => handleProgramChange(e.target.value)}>
                <option value="">吏곸젒 ?낅젰</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name} ({p.ratio}) 쨌 {p.unit_minutes}遺?/option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?덉뒯 醫낅쪟 ?대쫫</label>
              <input className="input-base" placeholder="媛쒖씤?덉뒯, 洹몃９?덉뒯 ?? value={lessonType} onChange={e => setLessonType(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?뚯썝</label>
              <select className="input-base" value={memberId} onChange={e => handleMemberChange(e.target.value)}>
                <option value="">?좏깮?섏꽭??/option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            {memberId && currentFamily.length > 0 && (
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>媛議?援ъ꽦??(?좏깮)</label>
                <select className="input-base" value={familyId} onChange={e => setFamilyId(e.target.value)}>
                  <option value="">蹂몄씤</option>
                  {currentFamily.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>肄붿튂</label>
              <select className="input-base" value={coachId} onChange={e => setCoachId(e.target.value)}>
                <option value="">?좏깮?섏꽭??/option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.name} 肄붿튂</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?섏뾽??/label>
              <select className="input-base" value={monthId} onChange={e => setMonthId(e.target.value)}>
                <option value="">?좏깮?섏꽭??/option>
                {months.map(m => <option key={m.id} value={m.id}>{m.year}??{m.month}??/option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?섍컯猷?(??</label>
              <input className="input-base" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>

        {/* ?섏뾽 ?⑥쐞 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>?섏뾽 ?쒓컙 (遺?</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[30,45,60,90].map(u => (
              <button key={u} onClick={() => setUnitMin(u)}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.625rem', border: `1.5px solid ${unitMin === u ? '#16A34A' : '#e5e7eb'}`, background: unitMin === u ? '#f0fdf4' : 'white', color: unitMin === u ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {u}遺?              </button>
            ))}
            <input type="number" placeholder="吏곸젒?낅젰" value={[30,45,60,90].includes(unitMin) ? '' : unitMin}
              onChange={e => setUnitMin(Number(e.target.value))}
              style={{ width: '90px', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', border: '1.5px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'Noto Sans KR, sans-serif' }} />
          </div>
        </div>

        {/* ?쇱젙 ?앹꽦 */}
        <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
          <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' }}>?섏뾽 ?쇱젙 ?앹꽦</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?쒖옉 ?좎쭨</label>
              <input type="date" className="input-base" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?섏뾽 ?붿씪</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    style={{ flex: 1, padding: '0.5rem 0', borderRadius: '0.625rem', border: `1.5px solid ${selectedDays.includes(i) ? '#16A34A' : '#e5e7eb'}`, background: selectedDays.includes(i) ? '#f0fdf4' : 'white', color: selectedDays.includes(i) ? '#16A34A' : '#6b7280', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>?섏뾽 ?쒓컙</label>
                <input type="time" className="input-base" value={time} onChange={e => setTime(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '6px' }}>珥??잛닔</label>
                <input type="number" className="input-base" value={count} onChange={e => setCount(Number(e.target.value))} min={1} max={50} />
              </div>
            </div>
            <button onClick={generateSchedules}
              style={{ padding: '0.75rem', borderRadius: '0.75rem', border: 'none', background: '#1d4ed8', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              ?뱟 ?쇱젙 ?먮룞 ?앹꽦
            </button>
          </div>
        </div>

        {/* ?앹꽦???쇱젙 */}
        {schedules.length > 0 && (
          <div style={{ background: 'white', borderRadius: '1rem', border: '1.5px solid #f3f4f6', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>?앹꽦???쇱젙</h2>
              <span style={{ marginLeft: '0.5rem', background: '#f0fdf4', color: '#16A34A', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>{schedules.length}??/span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
              {schedules.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.625rem' }}>
                  <span style={{ flex: 1, fontSize: '0.85rem', color: '#374151' }}>{fmtDt(s.datetime)} 쨌 {s.duration}遺?/span>
                  <button onClick={() => removeSlot(i)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>횞</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '0.75rem', padding: '0.875rem 1rem', color: '#b91c1c', fontSize: '0.875rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={saving}
          style={{ padding: '1rem', borderRadius: '0.75rem', border: 'none', background: '#16A34A', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '1rem', fontFamily: 'Noto Sans KR, sans-serif' }}>
          {saving ? '?깅줉 以?..' : '?덉뒯 ?뚮옖 ?깅줉'}
        </button>
      </div>
    </div>
  )
}

