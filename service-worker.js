/* SISTEM STRUK POJOK DATA — service worker
   - File aplikasi: coba jaringan dulu (maks. 3 detik) agar pembaruan langsung terlihat,
     bila offline/lambat dipakai salinan tersimpan sehingga aplikasi tetap bisa dibuka.
   - Pustaka OCR dari CDN: disimpan setelah pertama kali dipakai (jika perangkat mengizinkan).
   Ganti VERSI bila ingin memaksa semua perangkat membuang salinan lama. */
const VERSI = 'v1';
const CACHE_APP = 'pojokdata-app-' + VERSI;
const CACHE_CDN = 'pojokdata-cdn-v1';
const INTI = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];
const HOST_CDN = ['cdn.jsdelivr.net', 'unpkg.com', 'tessdata.projectnaptha.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_APP)
      .then(c => Promise.all(INTI.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_APP && n !== CACHE_CDN).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

async function jaringanDulu(req) {
  const cache = await caches.open(CACHE_APP);
  const salinan = () =>
    cache.match(req, { ignoreSearch: true })
      .then(r => r || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
  const net = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  });
  try {
    return await Promise.race([net, new Promise((_, tolak) => setTimeout(() => tolak(new Error('lambat')), 3000))]);
  } catch (err) {
    const c = await salinan();
    if (c) return c;
    return net;                       // tidak ada salinan: tunggu jaringan
  }
}

async function salinanDulu(req) {
  const cache = await caches.open(CACHE_CDN);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(jaringanDulu(req));
  else if (HOST_CDN.includes(url.hostname)) e.respondWith(salinanDulu(req));
});
