/* 오프라인 캐시. 버전을 올리면 다음 방문 때 새 파일로 교체됩니다. */
const VERSION = 'v1';
const CACHE = 'bw-' + VERSION;
const SHELL = ['./', './index.html', './style.css', './app.js', './program.js', './poses.js', './figure.js',
               './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
/* 네트워크 우선, 실패하면 캐시. 새 버전이 배포되면 바로 반영되고 오프라인이어도 열립니다. */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
