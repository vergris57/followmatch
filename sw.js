/* FollowsMatch — service worker : mode hors-ligne (coquille de l'app) + notifications push */
const CACHE = 'fm-shell-v7';
const SHELL = ['./', './index.html', './config.js', './supabase.js', './manifest.json',
               './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' }))))
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Données (Supabase, CDN) : on laisse passer le réseau normalement.
   Fichiers de l'app (même origine) : réseau d'abord, cache en secours (hors-ligne). */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // Supabase & scripts externes non touchés
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});

/* Réception d'une notification push envoyée par le serveur */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (_) { d = { title: 'FollowsMatch', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'FollowsMatch', {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    lang: 'fr',
    vibrate: [80, 40, 80],
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || './' }
  }));
});

/* Clic sur la notification : on ouvre / met au premier plan l'app */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) { c.focus(); if ('navigate' in c) c.navigate(target); return; }
    }
    if (clients.openWindow) return clients.openWindow(target);
  }));
});
