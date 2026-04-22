'use client'
// 수업초안확정 페이지의 "이름 검색 → 일정 조회 → 슬롯 삭제" 섹션
//
// 렌더 격리 구조:
//   ScheduleDraftSearchInner   — 전체 섹션 (prefetch, 선택된 profile, 슬롯 리스트)
//   └─ SearchInputBox          — 입력창 전용, 타이핑 시 여기만 재렌더됨
//      (내부 local state → 부모로는 debounce 후 finalized value 만 전달)
//
// 이렇게 하면 타이핑마다 결과 리스트 · 선택된 사람 섹션이 재렌더되지 않아
// 입력 lag 가 완전히 제거됨.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Profile { id: string; name: string; phone?: string; role: string }
interface IndexedProfile extends Profile { _nameLC: string; _phone: string }
interface Month   { id: string; year: number; month: number }

interface Props {
  monthId: string
  selMonth: Month | undefined
  saving: boolean
  onSlotChanged: () => void
  fmtSlot: (iso: string) => { full: string }
}

// ─── 모듈 레벨 스타일 상수 (매 render 마다 object 재할당 방지) ────────────
const styIn: React.CSSProperties = {
  width:'100%', padding:'0.625rem 0.875rem',
  border:'1.5px solid #e5e7eb', borderRadius:'0.625rem',
  fontSize:'0.9rem', fontFamily:'Noto Sans KR, sans-serif',
}
const styListBox: React.CSSProperties = { marginTop:'0.5rem', maxHeight:220, overflowY:'auto', border:'1px solid #f3f4f6', borderRadius:8 }
const styEmpty:   React.CSSProperties = { padding:'0.75rem', textAlign:'center', color:'#9ca3af', fontSize:'0.8rem' }

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: '초안',   color: '#92400e', bg: '#fef3c7' },
  scheduled: { label: '예정',   color: '#15803d', bg: '#dcfce7' },
  completed: { label: '완료',   color: '#1d4ed8', bg: '#dbeafe' },
  absent:    { label: '결석',   color: '#b91c1c', bg: '#fee2e2' },
  cancelled: { label: '취소',   color: '#6b7280', bg: '#f3f4f6' },
  makeup:    { label: '보강',   color: '#7e22ce', bg: '#f3e8ff' },
}

// ─── 입력창만 다루는 소형 컴포넌트 ────────────────────────────────────────
// 내부 state 로 매 keystroke 즉시 paint, 부모에는 디바운스된 값만 전달
function SearchInputBox({ onCommit }: { onCommit: (val: string) => void }) {
  const [val, setVal] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setVal(next)  // 즉시 paint
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onCommit(next), 60)  // 60ms 후 필터 발동
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <input
      value={val}
      onChange={handleChange}
      placeholder="이름 또는 이름 일부 (예: 양은, 신승)"
      style={styIn}
    />
  )
}

function ScheduleDraftSearchInner({ monthId, selMonth, saving, onSlotChanged, fmtSlot }: Props) {
  const [searchOpen,      setSearchOpen]      = useState(false)
  const [committedQ,      setCommittedQ]      = useState('')  // 필터용 (디바운스 후 커밋된 값)
  const [allProfiles,     setAllProfiles]     = useState<IndexedProfile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [selProfile,      setSelProfile]      = useState<Profile | null>(null)
  const [personSlots,     setPersonSlots]     = useState<any[]>([])
  const [personLoading,   setPersonLoading]   = useState(false)
  const [localBusy,       setLocalBusy]       = useState(false)
  const [localMsg,        setLocalMsg]        = useState('')

  // 최초 열릴 때 전체 회원/코치 prefetch + 소문자 인덱스
  useEffect(() => {
    if (!searchOpen || allProfiles.length > 0 || profilesLoading) return
    setProfilesLoading(true)
    fetch('/api/profiles/search?q=*')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : []
        const indexed: IndexedProfile[] = list.map((p: Profile) => ({
          ...p,
          _nameLC: (p.name ?? '').toLowerCase(),
          _phone:  (p.phone ?? '').replace(/[-\s]/g, ''),
        }))
        setAllProfiles(indexed)
      })
      .finally(() => setProfilesLoading(false))
  }, [searchOpen, allProfiles.length, profilesLoading])

  // 필터 — committedQ 변할 때만 재계산 (max 12)
  const searchResults = useMemo(() => {
    const raw = committedQ.trim()
    if (!raw) return []
    const q = raw.toLowerCase()
    const qDigits = raw.replace(/[-\s]/g, '')
    const out: IndexedProfile[] = []
    for (const p of allProfiles) {
      if (p._nameLC.includes(q) || (qDigits && p._phone.includes(qDigits))) {
        out.push(p)
        if (out.length >= 12) break
      }
    }
    return out
  }, [committedQ, allProfiles])

  const loadPerson = useCallback(async (profile: Profile) => {
    if (!monthId) return
    setSelProfile(profile)
    setPersonLoading(true)
    try {
      const res = await fetch(`/api/slots-by-person?profile_id=${profile.id}&month_id=${monthId}`)
      const data = await res.json()
      setPersonSlots(Array.isArray(data?.slots) ? data.slots : [])
    } finally {
      setPersonLoading(false)
    }
  }, [monthId])

  const handleDeleteSlot = useCallback(async (slotId: string) => {
    if (!confirm('이 슬롯을 삭제할까요?\n해당 월 레슨비가 자동 재계산됩니다.')) return
    setLocalBusy(true); setLocalMsg('')
    const res = await fetch(`/api/lesson-slots/${slotId}`, { method: 'DELETE' })
    setLocalBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setLocalMsg('❌ ' + (d.error ?? '삭제 실패'))
      return
    }
    setLocalMsg('🗑 슬롯 삭제됨')
    if (selProfile) loadPerson(selProfile)
    onSlotChanged()
  }, [selProfile, loadPerson, onSlotChanged])

  return (
    <div style={{
      background:'white', border:'1.5px solid #e5e7eb', borderRadius:'1rem',
      marginBottom:'0.75rem', overflow:'hidden',
    }}>
      <button
        onClick={() => setSearchOpen(v => !v)}
        style={{
          width:'100%', padding:'0.875rem 1rem', border:'none', background:'transparent',
          display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer',
          fontFamily:'Noto Sans KR, sans-serif',
        }}
      >
        <span style={{ fontSize:'0.75rem', fontWeight:700, color:'#6b7280' }}>🔎 이름 검색</span>
        <span style={{ fontSize:'0.8rem', color:'#111827', flex:1, textAlign:'left' }}>
          회원/코치 이름으로 해당 월 일정 조회 · 슬롯 삭제
        </span>
        <span style={{ fontSize:'0.8rem', color:'#9ca3af' }}>{searchOpen ? '▲' : '▼'}</span>
      </button>

      {searchOpen && (
        <div style={{ borderTop:'1px solid #f3f4f6', padding:'1rem' }}>
          {/* ✅ 입력창 전담 컴포넌트 — 타이핑이 결과 리스트에 전파되지 않음 */}
          <SearchInputBox onCommit={setCommittedQ} />

          {profilesLoading && (
            <div style={{ marginTop:'0.5rem', padding:'0.5rem', textAlign:'center', color:'#9ca3af', fontSize:'0.75rem' }}>
              회원/코치 목록 준비 중…
            </div>
          )}

          {localMsg && (
            <div style={{ marginTop:'0.5rem', padding:'0.45rem 0.625rem',
              background: localMsg.startsWith('❌') ? '#fef2f2' : '#f0fdf4',
              color: localMsg.startsWith('❌') ? '#b91c1c' : '#15803d',
              borderRadius:8, fontSize:'0.75rem' }}>{localMsg}</div>
          )}

          {committedQ.trim() && !profilesLoading && (
            <div style={styListBox}>
              {searchResults.length === 0 ? (
                <div style={styEmpty}>결과 없음</div>
              ) : (
                searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => loadPerson(p)}
                    style={{
                      width:'100%', textAlign:'left',
                      padding:'0.5rem 0.75rem', border:'none',
                      borderBottom:'1px solid #f3f4f6',
                      background: selProfile?.id === p.id ? '#eff6ff' : 'white',
                      cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                    }}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <span style={{
                        fontSize:'0.65rem', fontWeight:700,
                        padding:'1px 6px', borderRadius:'9999px',
                        background: p.role === 'coach' ? '#fef3c7' : '#dcfce7',
                        color:      p.role === 'coach' ? '#92400e' : '#166534',
                      }}>{p.role === 'coach' ? '코치' : '회원'}</span>
                      <span style={{ fontSize:'0.85rem', fontWeight:600, color:'#111827' }}>{p.name}</span>
                      {p.phone && <span style={{ fontSize:'0.7rem', color:'#9ca3af', marginLeft:'auto' }}>{p.phone}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {selProfile && (
            <div style={{ marginTop:'0.75rem', padding:'0.75rem', background:'#f9fafb', borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.5rem' }}>
                <span style={{ fontSize:'0.85rem', fontWeight:700, color:'#111827' }}>
                  {selProfile.name} ({selProfile.role === 'coach' ? '코치' : '회원'}) — {selMonth?.year}년 {selMonth?.month}월
                </span>
                <button onClick={() => { setSelProfile(null); setPersonSlots([]) }}
                  style={{ marginLeft:'auto', border:'none', background:'transparent', color:'#9ca3af', fontSize:'0.75rem', cursor:'pointer' }}>
                  닫기
                </button>
              </div>

              {personLoading ? (
                <div style={{ padding:'0.75rem', textAlign:'center', color:'#9ca3af', fontSize:'0.8rem' }}>불러오는 중…</div>
              ) : personSlots.length === 0 ? (
                <div style={{ padding:'0.75rem', textAlign:'center', color:'#9ca3af', fontSize:'0.8rem' }}>
                  이 월에 일정이 없습니다
                  {selProfile.role === 'member' && ' (다음달로 미이동 회원일 수 있음)'}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'0.375rem' }}>
                  {personSlots.map((s: any) => {
                    const { full } = fmtSlot(s.scheduled_at)
                    const memberName = s.family_member_name ?? s.lesson_plan?.member?.name ?? '-'
                    const coachName  = s.lesson_plan?.coach?.name ?? '-'
                    const st = STATUS_LABEL[s.status] ?? { label: s.status, color:'#374151', bg:'#f3f4f6' }
                    return (
                      <div key={s.id} style={{
                        background:'white', border:'1px solid #e5e7eb', borderRadius:8,
                        padding:'0.5rem 0.625rem',
                        display:'flex', alignItems:'center', gap:'0.5rem',
                      }}>
                        <span style={{
                          fontSize:'0.65rem', fontWeight:700,
                          padding:'1px 6px', borderRadius:'9999px',
                          background:st.bg, color:st.color, flexShrink:0,
                        }}>{st.label}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'0.8rem', fontWeight:600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {full} · {
                              selProfile.role === 'coach'
                                ? memberName
                                : (
                                  s.family_member_name
                                    ? `자녀 ${s.family_member_name} · ${coachName} 코치`
                                    : `${coachName} 코치`
                                )
                            }
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSlot(s.id)}
                          disabled={saving || localBusy || s.status === 'completed'}
                          title={s.status === 'completed' ? '완료된 수업은 삭제 불가' : ''}
                          style={{
                            padding:'0.25rem 0.625rem', borderRadius:6,
                            border:'1.5px solid #fecaca', background:'#fef2f2',
                            color:'#b91c1c', fontSize:'0.7rem', fontWeight:700,
                            cursor: (saving || localBusy || s.status === 'completed') ? 'not-allowed' : 'pointer',
                            opacity: (saving || localBusy || s.status === 'completed') ? 0.4 : 1,
                          }}
                        >삭제</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(ScheduleDraftSearchInner)
