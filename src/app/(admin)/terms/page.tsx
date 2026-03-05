'use client'
import { useState, useEffect } from 'react'
import TopBar from '@/components/ui/TopBar'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function AdminTermsPage() {
  const [terms, setTerms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [content, setContent] = useState('')
  const [version, setVersion] = useState('')
  const [memo, setMemo] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadTerms() }, [])

  async function loadTerms() {
    setLoading(true)
    const res = await fetch('/api/admin/terms')
    const data = await res.json()
    setTerms(data.terms ?? [])
    setLoading(false)
  }

  async function handleSubmit() {
    if (!content.trim()) { setError('약관 내용을 입력해 주세요.'); return }
    if (!version.trim()) { setError('버전을 입력해 주세요.'); return }
    setProcessing(true); setError('')
    try {
      const res = await fetch('/api/admin/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, version, memo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowForm(false); setContent(''); setVersion(''); setMemo('')
      await loadTerms()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleSetCurrent(id: string) {
    await fetch('/api/admin/terms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await loadTerms()
  }

  return (
    <div className="flex flex-col">
      <TopBar title="약관 관리" showBack
        rightSlot={
          <button onClick={() => setShowForm(v => !v)}
            className="px-3 py-1.5 rounded-xl bg-[#1B4D2E] text-white text-xs font-medium">
            {showForm ? '취소' : '+ 새 약관'}
          </button>
        }
      />

      <div className="px-4 pt-4 pb-24 space-y-4">

        {/* 새 약관 등록 폼 */}
        {showForm && (
          <div className="wta-card space-y-3">
            <div className="font-semibold text-[#0F2010] text-sm">새 약관 등록</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5A8A5A] uppercase tracking-wider mb-2">버전 <span className="text-[#C85A1E]">*</span></label>
                <input className="wta-input font-mono" placeholder="v1.0" value={version}
                  onChange={e => setVersion(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5A8A5A] uppercase tracking-wider mb-2">메모</label>
                <input className="wta-input" placeholder="변경 사항" value={memo}
                  onChange={e => setMemo(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5A8A5A] uppercase tracking-wider mb-2">약관 내용 <span className="text-[#C85A1E]">*</span></label>
              <textarea className="wta-input resize-none leading-relaxed" rows={10}
                placeholder="약관 내용을 입력해 주세요..."
                value={content} onChange={e => setContent(e.target.value)} />
            </div>
            {error && <div className="text-xs text-red-600">{error}</div>}
            <button onClick={handleSubmit} disabled={processing}
              className="wta-btn-primary disabled:opacity-50">
              {processing ? '저장 중...' : '📋 약관 등록'}
            </button>
          </div>
        )}

        {/* 약관 목록 */}
        {loading ? (
          <div className="text-center py-12 text-sm text-[#5A8A5A]">로딩 중...</div>
        ) : terms.length === 0 ? (
          <div className="wta-card text-center py-12 text-sm text-[#5A8A5A]">
            등록된 약관이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {terms.map(t => (
              <div key={t.id} className={`wta-card space-y-3 ${t.is_current ? 'border-[#1B4D2E]/30' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-oswald text-lg font-bold text-[#1B4D2E]">{t.version}</span>
                      {t.is_current && <span className="badge-green">현행</span>}
                    </div>
                    <div className="text-xs text-[#5A8A5A] mt-1">
                      {format(new Date(t.created_at), 'yyyy.M.d HH:mm', { locale: ko })}
                      {t.memo && ` · ${t.memo}`}
                    </div>
                  </div>
                  {!t.is_current && (
                    <button onClick={() => handleSetCurrent(t.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#EAF3EA] text-[#1B4D2E] text-xs font-medium border border-[#1B4D2E]/15">
                      현행 설정
                    </button>
                  )}
                </div>
                <div className="bg-[#F5FAF5] rounded-xl p-3 max-h-32 overflow-y-auto text-xs text-[#2A5A2A] leading-relaxed whitespace-pre-wrap">
                  {t.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
