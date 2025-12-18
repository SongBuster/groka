/* Service Worker for Groka PWA */

const CACHE_NAME = 'groka-v1'
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell')
      return cache.addAll(urlsToCache).catch((err) => {
        console.warn('[SW] Cache addAll error:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const { url } = request

  // Skip cross-origin requests
  if (!url.startsWith(self.location.origin)) {
    return
  }

  // Skip API requests - always fetch fresh
  if (url.includes('/rest/v1/') || url.includes('supabase')) {
    event.respondWith(fetch(request))
    return
  }

  // For everything else, try cache first, then network
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response
      }

      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response
          }

          // Clone the response
          const responseToCache = response.clone()

          // Cache successful responses for static assets
          if (request.method === 'GET') {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }

          return response
        })
        .catch(() => {
          // Return a fallback page or error response
          console.log('[SW] Fetch failed:', url)
          return new Response('Offline - content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain',
            }),
          })
        })
    })
  )
})
