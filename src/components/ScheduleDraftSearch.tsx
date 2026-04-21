'use client'
// 수업초안확정 페이지의 "이름 검색 → 일정 조회 → 슬롯 삭제" 섹션
// ✅ 독립 컴포넌트로 분리: 부모의 초안 리스트가 타이핑마다 재렌더되지 않도록 격리
//   - 자체 state 만 관리 (searchQ, allProfiles, selProfile, personSlots ...)
//   - monthId 만 props 로 받음
//   - onSlotChanged 콜백으로 삭제 시 부모 리로드 트리거
import { memo, useEffect, useState } from 'react'

interface Profile { id: string; name: string; phone?: string; role: string }
interface Month   { id: string; year: number; month: number }

interface Props {
  monthId: string
  selMonth: Month | undefined
  saving: boolean
  onSlotChanged: () => void
  fmtSlot: (iso: string) => { full: string }
}

function ScheduleDraftSearchInner({ monthId, selMonth, saving, onSlotChanged, fmtSlot }: Props) {
  const [searchOpen,      setSearchOpen]      = useState(false)
  const [searchQ,         setSearchQ]         = useState('')
  const [allProfiles,     setAllProfiles]     = useState<Profile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [selProfile,      setSelProfile]      = useState<Profile | null>(null)
  const [personSlots,     setPersonSlots]     = useState<any[]>([])
  const [personLoading,   setPersonLoading]   = useState(false)
  const [localBusy,       setLocalBusy]       = useState(false)
  const [localMsg,        setLocalMsg]        = useState('')

  // 최초 열릴 때 전체 회원/코치 prefetch
  useEffect(() => {
    if (!searchOpen || allProfiles.length > 0 || profilesLoading) return
    setProfilesLoading(true)
    fetch('/api/profiles/search?q=*')
      .then(r => r.json())
      .then(d => setAllProfiles(Array.isArray(d) ? d : []))
      .finally(() => setProfilesLoading(false))
  }, [searchOpen, allProfiles.length, profilesLoading])

  // 클라이언트 사이드 필터
  const searchResults = (() => {
    const q = searchQ.trim().toLowerCase()
    if (!q) return []
    return allProfiles
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.phone ?? '').includes(q))
      .slice(0, 30)
  })()

  async function loadPerson(profile: Profile) {
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
  }

  async function handleDeleteSlot(slotId: string) {
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
  }

  const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
    draft:     { label: '초안',   color: '#92400e', bg: '#fef3c7' },
    scheduled: { label: '예정',   color: '#15803d', bg: '#dcfce7' },
    completed: { label: '완료',   color: '#1d4ed8', bg: '#dbeafe' },
    absent:    { label: '결석',   color: '#b91c1c', bg: '#fee2e2' },
    cancelled: { label: '취소',   color: '#6b7280', bg: '#f3f4f6' },
    makeup:    { label: '보강',   color: '#7e22ce', bg: '#f3e8ff' },
  }

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
          <input
            autoFocus
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="이름 또는 이름 일부 (예: 양은, 신승)"
            style={{
              width:'100%', padding:'0.625rem 0.875rem',
              border:'1.5px solid #e5e7eb', borderRadius:'0.625rem',
              fontSize:'0.9rem', fontFamily:'Noto Sans KR, sans-serif',
            }}
          />

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

          {searchQ.trim() && !profilesLoading && (
            <div style={{ marginTop:'0.5rem', maxHeight:220, overflowY:'auto', border:'1px solid #f3f4f6', borderRadius:8 }}>
              {searchResults.length === 0 ? (
                <div style={{ padding:'0.75rem', textAlign:'center', color:'#9ca3af', fontSize:'0.8rem' }}>결과 없음</div>
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
                    const st = statusLabel[s.status] ?? { label: s.status, color:'#374151', bg:'#f3f4f6' }
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

// monthId/selMonth/saving 만 바뀔 때 재렌더. 내부 state 타이핑은 부모에 전파 안 됨
export default memo(ScheduleDraftSearchInner)
