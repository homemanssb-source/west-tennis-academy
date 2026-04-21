'use client'
// src/components/SlotActionsModal.tsx
// 주간 스케줄에서 슬롯 카드 클릭 시 열리는 액션 모달
// - 그룹이면 회원 여러 명, 1:1이면 1명
// - 각 회원별 [제외] / [회원 변경] 가능
// - 모바일: 하단 시트, 데스크톱: 중앙 모달

import { useEffect, useState } from 'react'

interface SlotLike {
  id: string
  scheduled_at: string
  duration_minutes: number
  lesson_plan?: {
    id: string
    lesson_type: string
    member: { id: string; name: string }
    coach: { id: string; name: string }
  }
  family_member_name?: string | null
}

interface MemberOption { id: string; name: string; phone?: string }

function fmtKST(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export default function SlotActionsModal({
  slots,
  onClose,
  onDone,
  isMobile,
}: {
  slots: SlotLike[]        // 같은 시간/코치 묶인 슬롯들 (그룹이면 여러 개)
  onClose: () => void
  onDone: () => void       // 작업 완료 후 재조회 트리거
  isMobile: boolean
}) {
  const [members, setMembers] = useState<MemberOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [swapFor, setSwapFor] = useState<string | null>(null) // slot.id 를 선택한 상태
  const [swapTarget, setSwapTarget] = useState<string>('')
  const [memberFilter, setMemberFilter] = useState('')

  useEffect(() => {
    fetch('/api/members')
      .then(r => r.ok ? r.json() : [])
      .then(d => setMembers(Array.isArray(d) ? d : []))
      .catch(() => setMembers([]))
  }, [])

  const first = slots[0]
  if (!first) return null
  const coachName = first.lesson_plan?.coach?.name ?? '-'
  const timeStr = fmtKST(first.scheduled_at)

  async function handleExclude(slotId: string, memberName: string) {
    if (!confirm(`${memberName} 회원의 이 수업을 삭제하시겠습니까?\n해당 레슨비가 자동 재계산됩니다.`)) return
    setBusy(true); setError(null)
    const res = await fetch(`/api/lesson-slots/${slotId}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? '삭제 실패')
      return
    }
    onDone()
  }

  async function handleSwap(slotId: string) {
    if (!swapTarget) { setError('변경할 회원을 선택하세요'); return }
    const newMember = members.find(m => m.id === swapTarget)
    if (!newMember) return
    if (!confirm(`이 수업을 ${newMember.name} 회원으로 변경합니다.\n(${newMember.name} 회원의 같은 시간 기존 수업이 있으면 삭제됩니다)`)) return
    setBusy(true); setError(null)
    const res = await fetch(`/api/lesson-slots/${slotId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swap_to_member_id: swapTarget }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? '회원 변경 실패')
      return
    }
    setSwapFor(null); setSwapTarget(''); setMemberFilter('')
    onDone()
  }

  const filteredMembers = memberFilter
    ? members.filter(m => m.name.includes(memberFilter) || (m.phone ?? '').includes(memberFilter))
    : members

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          width: isMobile ? '100%' : '420px',
          maxHeight: isMobile ? '85vh' : '80vh',
          borderRadius: isMobile ? '16px 16px 0 0' : '16px',
          padding: '1.25rem',
          overflowY: 'auto',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{coachName} 코치</div>
            <div style={{ fontFamily: 'Oswald,sans-serif', fontWeight: 700, fontSize: '1.25rem' }}>{timeStr}</div>
          </div>
          <button onClick={onClose}
            style={{ border: 'none', background: '#f3f4f6', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>

        {error && (
          <div style={{ padding: '0.5rem 0.75rem', background: '#fef2f2', color: '#b91c1c', borderRadius: 8, fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {slots.map(s => {
            const memberName = s.family_member_name ?? s.lesson_plan?.member?.name ?? '-'
            const subName = s.family_member_name ? `(${s.lesson_plan?.member?.name ?? ''})` : ''
            return (
              <div key={s.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.625rem 0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {memberName}
                    </div>
                    {subName && <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{subName}</div>}
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => handleExclude(s.id, memberName)}
                    style={{
                      padding: '0.375rem 0.625rem', borderRadius: 8, border: '1.5px solid #fecaca',
                      background: '#fef2f2', color: '#b91c1c', fontSize: '0.75rem', fontWeight: 600,
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >제외</button>
                  <button
                    disabled={busy}
                    onClick={() => { setSwapFor(swapFor === s.id ? null : s.id); setSwapTarget(''); setMemberFilter(''); setError(null) }}
                    style={{
                      padding: '0.375rem 0.625rem', borderRadius: 8, border: '1.5px solid #bfdbfe',
                      background: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', fontWeight: 600,
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >회원 변경</button>
                </div>

                {swapFor === s.id && (
                  <div style={{ marginTop: '0.625rem', paddingTop: '0.625rem', borderTop: '1px dashed #e5e7eb' }}>
                    <input
                      autoFocus
                      value={memberFilter}
                      onChange={e => setMemberFilter(e.target.value)}
                      placeholder="이름 또는 전화번호 검색"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem', marginBottom: '0.5rem' }}
                    />
                    <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #f3f4f6', borderRadius: 8 }}>
                      {filteredMembers.slice(0, 50).map(m => (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.625rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: swapTarget === m.id ? '#eff6ff' : 'white' }}>
                          <input
                            type="radio"
                            name={`swap-${s.id}`}
                            checked={swapTarget === m.id}
                            onChange={() => setSwapTarget(m.id)}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827' }}>{m.name}</div>
                            {m.phone && <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{m.phone}</div>}
                          </div>
                        </label>
                      ))}
                      {filteredMembers.length === 0 && (
                        <div style={{ padding: '0.75rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem' }}>일치하는 회원 없음</div>
                      )}
                    </div>
                    <button
                      disabled={busy || !swapTarget}
                      onClick={() => handleSwap(s.id)}
                      style={{
                        marginTop: '0.5rem', width: '100%',
                        padding: '0.625rem', borderRadius: 8, border: 'none',
                        background: swapTarget ? '#16A34A' : '#d1d5db', color: 'white',
                        fontSize: '0.9rem', fontWeight: 700, cursor: swapTarget && !busy ? 'pointer' : 'not-allowed',
                      }}
                    >{busy ? '처리 중...' : '변경 확정'}</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '0.875rem', fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center' }}>
          작업 시 해당 월의 레슨비가 자동 재계산됩니다.
        </div>
      </div>
    </div>
  )
}
