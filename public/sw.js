const CACHE = 'gods-unleashed-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Network-first: always fetch fresh, fall back to cache for offline resilience
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith('http')) return
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && res.status !== 206) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
