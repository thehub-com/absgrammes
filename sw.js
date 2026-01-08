// Service Worker для офлайн работы
const CACHE_NAME = 'absgram-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Вы офлайн. Проверьте подключение к интернету.', {
        headers: { 'Content-Type': 'text/plain' }
      });
    })
  );
});
