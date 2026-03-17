'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePush } from '@/lib/usePush'

interface Notification {
  id: string
  title: string
  body: string
  type: string
  is_read: boolean
  link: string | null
  created_at: string
}

const TYPE_STYLE: Record<string, { bg: string; color: string; emoji: string }> = {
  info:    { bg: '#eff6ff', color: '#1d4ed8', emoji: 'ℹ️' },
  success: { bg: '#f0fdf4', color: '#15803d', emoji: '✅' },
  warning: { bg: '#fef9c3', color: '#854d0e', emoji: '⚠️' },
  error:   { bg: '#fef2f2', color: '#b91c1c', emoji: '❌' },
}

export default function NotificationBell() {
  const router = useRouter()
  const { supported, subscribed, subscribe, unsubscribe } = usePush()
  const [notifs,      setNotifs]      = useState<Notification[]>([])
  const [open,        setOpen]        = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })

  const unread = notifs.filter(n => !n.is_read).length

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/notifications')
    const data = await res.json()
    setNotifs(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const handleClick = async (n: Notification) => {
    if (n.link) {
      setOpen(false)
      router.push(n.link)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  const handlePushToggle = async () => {
    setPushLoading(true)
    try {
      if (subscribed) await unsubscribe()
      else await subscribe()
    } finally {
      setPushLoading(false)
    }
  }

  // 벨 버튼 위치를 기준으로 드롭다운 좌표 계산
  const handleBellClick = async () => {
    const next = !open
    if (next && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
      await load()
      await markAllRead()
    }
    setOpen(next)
  }

  const fmt = (dt: string) => {
    const diff = Math.floor((Date.now() - new Date(dt).getTime()) / 1000)
    if (diff < 60) return '방금'
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
    return `${Math.floor(diff / 86400)}일 전`
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>

        {/* 푸시 알림 버튼 */}
        {supported && (
          <button
            onClick={handlePushToggle}
            disabled={pushLoading}
            title={subscribed ? '푸시 알림 끄기' : '푸시 알림 켜기'}
            style={{
              background: subscribed ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
              border: `1.5px solid ${subscribed ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'}`,
              borderRadius: '0.625rem',
              padding: '0.35rem 0.6rem',
              cursor: pushLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'white',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '0.85rem' }}>{subscribed ? '🔔' : '🔕'}</span>
            <span>{pushLoading ? '...' : subscribed ? 'ON' : 'OFF'}</span>
          </button>
        )}

        {/* 벨 버튼 */}
        <button
          ref={bellRef}
          onClick={handleBellClick}
          style={{
            position: 'relative',
            background: 'rgba(255,255,255,0.15)',
            border: '1.5px solid rgba(255,255,255,0.3)',
            borderRadius: '0.75rem',
            width: '2.5rem',
            height: '2.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.1rem',
          }}
        >
          🔔
          {unread > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: 'white',
              fontSize: '0.6rem',
              fontWeight: 700,
              minWidth: '16px',
              height: '16px',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
            }}>
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* 드롭다운 — position: fixed 로 뷰포트 기준 배치 → 짤림 없음 */}
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'fixed',
            top: dropdownPos.top,
            right: dropdownPos.right,
            width: '320px',
            maxWidth: 'calc(100vw - 1rem)',
            background: 'white',
            borderRadius: '1rem',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            zIndex: 50,
            overflow: 'hidden',
          }}>
            {/* 헤더 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1rem',
              borderBottom: '1px solid #f3f4f6',
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>알림</span>
              {notifs.length > 0 && (
                <button
                  onClick={async () => {
                    await Promise.all(notifs.map(n =>
                      fetch(`/api/notifications/${n.id}`, { method: 'DELETE' })
                    ))
                    setNotifs([])
                  }}
                  style={{ fontSize: '0.72rem', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  전체 삭제
                </button>
              )}
            </div>

            {/* 알림 목록 */}
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                  로딩 중...
                </div>
              ) : notifs.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                  알림이 없습니다
                </div>
              ) : (
                notifs.map(n => {
                  const st = TYPE_STYLE[n.type] ?? TYPE_STYLE.info
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      style={{
                        padding: '0.875rem 1rem',
                        borderBottom: '1px solid #f9fafb',
                        cursor: n.link ? 'pointer' : 'default',
                        background: n.is_read ? 'white' : '#f0f9ff',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start',
                      }}
                    >
                      <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>{st.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.8rem', color: '#111827' }}>{n.title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px', lineHeight: 1.4 }}>{n.body}</div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '4px' }}>{fmt(n.created_at)}</div>
                      </div>
                      {/* 단건 삭제 버튼 */}
                      <button
                        onClick={e => handleDelete(e, n.id)}
                        title="삭제"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#d1d5db',
                          fontSize: '0.85rem',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}
                      >
                        ✕
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}