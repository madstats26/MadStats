/* Mad Stats offline worker. Bump VERSION on every release so phones pick up the update. */
const VERSION = 'madstats-2026-11-04-7';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'guide.pdf'];
const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'];  // the team sheet reader is cached the first time it's used

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(SHELL);
    await Promise.all(LIBS.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
  }));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.url.startsWith('blob:') || req.url.startsWith('data:')) return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // App files: serve the installed version, fall back to the network.
    const isApp = req.mode === 'navigate' && /\/(index\.html)?$/.test(url.pathname);
    const key = isApp ? 'index.html' : req;
    e.respondWith(caches.match(key, { ignoreSearch: true }).then(hit => hit || fetch(req)));
    return;
  }
  if (/^(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|tessdata\.projectnaptha\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
    // Fonts and the PDF library: use the saved copy, refresh it in the background.
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
