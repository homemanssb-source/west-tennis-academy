'use client'
import { useState, useEffect } from 'react'
import TopBar from '@/components/ui/TopBar'

const ROLES = ['전체', '회원', '코치', '결제담당', '관리자']
const ROLE_MAP: Record<string, string> = {
  '회원': 'member', '코치': 'coach', '결제담당': 'payment_manager', '관리자': 'admin',
}
const ROLE_LABEL: Record<string, string> = {
  member: '회원', coach: '코치', payment_manager: '결제담당', admin: '관리자',
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [processing, setProcessing] = useState(false)
  const [newRole, setNewRole] = useState('')
  const [newPin, setNewPin] = useState('')

  useEffect(() => { loadMembers() }, [])

  async function loadMembers() {
    setLoading(true)
    const res = await fetch('/api/admin/members')
    const data = await res.json()
    setMembers(data.members ?? [])
    setLoading(false)
  }

  const filtered = members.filter(m => {
    const roleMatch = filter === '전체' || m.role === ROLE_MAP[filter]
    const searchMatch = !search || m.name.includes(search) || m.phone.includes(search)
    return roleMatch && searchMatch
  })

  async function handleUpdateRole() {
    if (!selected || !newRole) return
    setProcessing(true)
    try {
      const res = await fetch('/api/admin/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selected.id, role: newRole }),
      })
      if (res.ok) { await loadMembers(); setSelected(null) }
    } finally { setProcessing(false) }
  }

  async function handleToggleActive() {
    if (!selected) return
    setProcessing(true)
    try {
      const res = await fetch('/api/admin/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selected.id, is_active: !selected.is_active }),
      })
      if (res.ok) { await loadMembers(); setSelected(null) }
    } finally { setProcessing(false) }
  }

  async function handleResetPin() {
    if (!selected || !newPin || newPin.length !== 6) return
    setProcessing(true)
    try {
      const res = await fetch('/api/admin/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selected.id, pin: newPin }),
      })
      if (res.ok) { setNewPin(''); setSelected(null) }
    } finally { setProcessing(false) }
  }

  return (
    <div className="flex flex-col">
      <TopBar title="회원 관리" subtitle={`${filtered.length}명`} showBack />

      <div className="px-4 pt-4 pb-24 space-y-3">
        {/* 검색 */}
        <input className="wta-input" placeholder="이름 또는 전화번호 검색"
          value={search} onChange={e => setSearch(e.target.value)} />

        {/* 역할 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {ROLES.map(r => (
            <button key={r} onClick={() => setFilter(r)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filter === r ? 'bg-[#1B4D2E] text-white border-[#1B4D2E]' : 'bg-white text-[#2A5A2A] border-[#1B4D2E]/15'
              }`}>
              {r}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-[#5A8A5A]">로딩 중...</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(m => {
              const isSelected = selected?.id === m.id
              return (
                <div key={m.id} className="wta-card space-y-3">
                  <div className="flex items-center justify-between" onClick={() => setSelected(isSelected ? null : m)}>
                    <div className="flex items-center gap-3 cursor-pointer">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        m.is_active ? 'bg-[#EAF3EA] text-[#1B4D2E]' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {m.name.charAt(0)}
                      </div>
                      <div>
                        <div className={`text-sm font-semibold ${m.is_active ? 'text-[#0F2010]' : 'text-gray-400'}`}>
                          {m.name}
                          {!m.is_active && <span className="ml-1 text-xs text-gray-400">(비활성)</span>}
                        </div>
                        <div className="text-xs text-[#5A8A5A] font-mono">{m.phone}</div>
                        {m.coach_name && <div className="text-xs text-[#5A8A5A]">{m.coach_name} 코치</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={
                        m.role === 'admin'           ? 'badge-red'  :
                        m.role === 'coach'           ? 'badge-blue' :
                        m.role === 'payment_manager' ? 'badge-gold' : 'badge-gray'
                      }>
                        {ROLE_LABEL[m.role]}
                      </span>
                      <span className="text-[#5A8A5A] text-sm">{isSelected ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="bg-[#F5FAF5] rounded-xl p-3 space-y-3">
                      {/* 역할 변경 */}
                      <div>
                        <label className="block text-[11px] font-medium text-[#5A8A5A] uppercase tracking-wider mb-2">역할 변경</label>
                        <div className="flex gap-2 flex-wrap mb-2">
                          {['member', 'coach', 'payment_manager', 'admin'].map(r => (
                            <button key={r} onClick={() => setNewRole(r)}
                              className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                                newRole === r ? 'bg-[#1B4D2E] text-white border-[#1B4D2E]' : 'bg-white text-[#2A5A2A] border-[#1B4D2E]/15'
                              }`}>
                              {ROLE_LABEL[r]}
                            </button>
                          ))}
                        </div>
                        <button onClick={handleUpdateRole} disabled={!newRole || processing}
                          className="w-full py-2.5 rounded-xl bg-[#1B4D2E] text-white text-sm font-medium disabled:opacity-40">
                          역할 변경 저장
                        </button>
                      </div>

                      {/* PIN 초기화 */}
                      <div>
                        <label className="block text-[11px] font-medium text-[#5A8A5A] uppercase tracking-wider mb-2">PIN 초기화</label>
                        <div className="flex gap-2">
                          <input type="tel" maxLength={6} className="wta-input font-mono tracking-widest text-center"
                            placeholder="새 PIN 6자리" value={newPin}
                            onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                          <button onClick={handleResetPin} disabled={newPin.length !== 6 || processing}
                            className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium disabled:opacity-40">
                            초기화
                          </button>
                        </div>
                      </div>

                      {/* 활성/비활성 */}
                      <button onClick={handleToggleActive} disabled={processing}
                        className={`w-full py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          m.is_active
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-[#EAF3EA] text-[#1B4D2E] border-[#1B4D2E]/20'
                        }`}>
                        {m.is_active ? '🚫 비활성화' : '✅ 활성화'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
