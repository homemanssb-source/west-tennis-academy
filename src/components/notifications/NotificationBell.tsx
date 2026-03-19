'use client'

import { useEffect, useState } from 'react'
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
    if (n.link) { setOpen(false); router.push(n.link) }
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

  const handleBellClick = async () => {
    const next = !open
    if (next) { await load(); await markAllRead() }
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
    <>
      {/* 벨 버튼 — 헤더에 배치 */}
      <button
        onClick={handleBellClick}
        style={{
          position: 'relative',
          background: 'rgba(255,255,255,0.15)',
          border: '1.5px solid rgba(255,255,255,0.3)',
          borderRadius: '0.75rem',
          width: '2.5rem', height: '2.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0,
        }}
        aria-label="알림"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#ef4444', color: 'white',
            fontSize: '0.6rem', fontWeight: 700,
            minWidth: '16px', height: '16px',
            borderRadius: '9999px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', pointerEvents: 'none',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* 바텀시트 (position:fixed 드롭다운 오류 해결) */}
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0,
            zIndex: 50,
            background: 'white',
            borderRadius: '1.25rem 1.25rem 0 0',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
            maxHeight: 'calc(100dvh - 80px)',
            display: 'flex', flexDirection: 'column',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}>
            {/* 드래그 핸들 */}
            <div style={{ width: '2.5rem', height: '0.25rem', background: '#d1d5db', borderRadius: '9999px', margin: '0.75rem auto 0', flexShrink: 0 }} />

            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem 0.75rem', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>
                알림
                {unread > 0 && (
                  <span style={{ marginLeft: '0.5rem', background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '9999px' }}>
                    {unread}
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {notifs.length > 0 && (
                  <button
                    onClick={async () => {
                      await Promise.all(notifs.map(n => fetch(`/api/notifications/${n.id}`, { method: 'DELETE' })))
                      setNotifs([])
                    }}
                    style={{ fontSize: '0.8rem', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                  >
                    전체 삭제
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '1.75rem', height: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', fontSize: '0.85rem', fontWeight: 700 }}
                >✕</button>
              </div>
            </div>

            {/* 푸시 구독 상태 — 드롭다운 내 배치 */}
            {supported && (
              <div style={{ padding: '0.625rem 1rem', background: subscribed ? '#f0fdf4' : '#f9fafb', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>{subscribed ? '🔔' : '🔕'}</span>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: subscribed ? '#15803d' : '#6b7280' }}>{subscribed ? '푸시 알림 켜짐' : '푸시 알림 꺼짐'}</div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{subscribed ? '새 알림을 즉시 받습니다' : '알림을 받으려면 켜세요'}</div>
                  </div>
                </div>
                <button
                  onClick={handlePushToggle}
                  disabled={pushLoading}
                  style={{ background: subscribed ? 'transparent' : '#7e22ce', border: subscribed ? '1.5px solid #e5e7eb' : 'none', borderRadius: '0.625rem', padding: '0.375rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: subscribed ? '#6b7280' : 'white', cursor: pushLoading ? 'wait' : 'pointer', minWidth: '3.5rem', minHeight: '2.25rem' }}
                >
                  {pushLoading ? '...' : subscribed ? '끄기' : '켜기'}
                </button>
              </div>
            )}

            {/* 알림 목록 */}
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {loading ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>불러오는 중...</div>
              ) : notifs.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#9ca3af' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</div>
                  <p style={{ fontSize: '0.875rem' }}>알림이 없습니다</p>
                </div>
              ) : (
                notifs.map(n => {
                  const st = TYPE_STYLE[n.type] ?? TYPE_STYLE.info
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #f9fafb', cursor: n.link ? 'pointer' : 'default', background: n.is_read ? 'white' : '#f0f9ff', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', minHeight: '3.5rem' }}
                    >
                      <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>{st.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: n.is_read ? 500 : 700, fontSize: '0.875rem', color: '#111827' }}>{n.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px', lineHeight: 1.4 }}>{n.body}</div>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '4px' }}>{fmt(n.created_at)}</div>
                      </div>
                      <button
                        onClick={e => handleDelete(e, n.id)}
                        aria-label="알림 삭제"
                        style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.75rem', padding: '0.25rem 0.375rem', borderRadius: '0.375rem', flexShrink: 0, minWidth: '1.75rem', minHeight: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >✕</button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}