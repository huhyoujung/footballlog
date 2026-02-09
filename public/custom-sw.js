/// <reference lib="webworker" />

const CACHE_NAME = 'football-log-v1';
const STATIC_CACHE = [
  '/',
  '/feed',
  '/write',
  '/icons/icon-192x192.png',
];

// Service Worker 설치
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_CACHE.map(url => new Request(url, { cache: 'reload' })));
    })
  );
  self.skipWaiting();
});

// 메시지 핸들러 (SKIP_WAITING 처리)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message');
    self.skipWaiting();
  }
});

// Service Worker 활성화
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 네트워크 요청 처리 (Network First 전략)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // API 요청은 캐시하지 않음
        if (event.request.url.includes('/api/')) {
          return response;
        }
        // 정적 리소스는 캐시
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 가져오기
        return caches.match(event.request);
      })
  );
});

// 🔔 푸시 알림 핸들러
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);

  if (!event.data) {
    console.log('[SW] Push event has no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
    console.log('[SW] Push data:', data);
  } catch (error) {
    console.error('[SW] Failed to parse push data:', error);
    return;
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url: data.url || '/' },
    tag: 'football-log-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '네모의 꿈', options)
      .then(() => console.log('[SW] Notification shown'))
      .catch((err) => console.error('[SW] Failed to show notification:', err))
  );
});

// 알림 클릭 핸들러
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // 이미 열린 탭이 있으면 포커스
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

console.log('[SW] Custom service worker loaded with push support');
