const CACHE_NAME = 'wta-v1'
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
]

// 설치
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// 활성화 — 이전 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// fetch — Network First (API), Cache First (정적)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API 요청 → 항상 네트워크
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request))
    return
  }

  // 정적 자산 → Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      }).catch(() => {
        // 오프라인 폴백
        if (event.request.mode === 'navigate') {
          return caches.match('/login')
        }
      })
    })
  )
})

// 푸시 알림
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? '서부 테니스 아카데미', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
      vibrate: [200, 100, 200],
    })
  )
})

// 알림 클릭 → 해당 페이지 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      const url = event.notification.data?.url ?? '/'
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
