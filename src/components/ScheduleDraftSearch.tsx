'use client'
// 수업초안확정 페이지의 "이름 검색 → 일정 조회 → 슬롯 삭제" 섹션
//
// 전략: 서버 사이드 debounced 검색 + 세션 캐시
//   - 초기 prefetch 없음 (콜드 스타트 시 10초+ 벽 회피)
//   - 200ms debounce 로 매 키스트로크 부담 최소
//   - 같은 q 는 Map 에 캐시 → 재타이핑 시 0ms
//   - 입력창은 SearchInputBox 로 분리 → 결과 리스트에 전파 안 됨
import { memo, useCallback, useEffect, useRef, useState } from 'react'

interface Profile { id: string; name: string; phone?: string; role: string }
interface Month   { id: string; year: number; month: number }

interface Props {
  monthId: string
  selMonth: Month | undefined
  saving: boolean
  onSlotChanged: () => void
  fmtSlot: (iso: string) => { full: string }
}

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

// 최소한의 uncontrolled input — 한글 IME 는 브라우저 네이티브가 처리
// React onChange 는 IME composition 완료 후에만 fire 되므로 별도 처리 불필요
function SearchInputBox({ onQueryChange }: { onQueryChange: (val: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <input
      defaultValue=""
      onChange={(e) => {
        const val = e.target.value
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => onQueryChange(val.trim()), 300)
      }}
      placeholder="이름 또는 이름 일부 (예: 양은, 신승)"
      style={styIn}
    />
  )
}

function ScheduleDraftSearchInner({ monthId, selMonth, saving, onSlotChanged, fmtSlot }: Props) {
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [query,          setQuery]          = useState('')      // debounced 커밋된 값
  const [results,        setResults]        = useState<Profile[]>([])
  const [searching,      setSearching]      = useState(false)
  const [selProfile,     setSelProfile]     = useState<Profile | null>(null)
  const [personSlots,    setPersonSlots]    = useState<any[]>([])
  const [personLoading,  setPersonLoading]  = useState(false)
  const [localBusy,      setLocalBusy]      = useState(false)
  const [localMsg,       setLocalMsg]       = useState('')

  // 세션 캐시 — 같은 q 재검색 시 즉시 반환
  const cacheRef = useRef<Map<string, Profile[]>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  // query 가 바뀌면 서버 검색 실행 (cache hit 시 즉시)
  useEffect(() => {
    if (!query) { setResults([]); setSearching(false); return }

    const cached = cacheRef.current.get(query)
    if (cached) { setResults(cached); setSearching(false); return }

    if (abortRef.current) abortRef.current.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setSearching(true)
    fetch(`/api/profiles/search?q=${encodeURIComponent(query)}`, { signal: ac.signal })
      .then(r => r.json())
      .then((d: Profile[]) => {
        const list = Array.isArray(d) ? d : []
        cacheRef.current.set(query, list)
        setResults(list)
      })
      .catch(() => { /* aborted or network err */ })
      .finally(() => { if (!ac.signal.aborted) setSearching(false) })

    return () => ac.abort()
  }, [query])

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
          <SearchInputBox onQueryChange={setQuery} />

          {localMsg && (
            <div style={{ marginTop:'0.5rem', padding:'0.45rem 0.625rem',
              background: localMsg.startsWith('❌') ? '#fef2f2' : '#f0fdf4',
              color: localMsg.startsWith('❌') ? '#b91c1c' : '#15803d',
              borderRadius:8, fontSize:'0.75rem' }}>{localMsg}</div>
          )}

          {query && (
            <div style={styListBox}>
              {searching ? (
                <div style={styEmpty}>검색 중…</div>
              ) : results.length === 0 ? (
                <div style={styEmpty}>결과 없음</div>
              ) : (
                results.slice(0, 12).map(p => (
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
