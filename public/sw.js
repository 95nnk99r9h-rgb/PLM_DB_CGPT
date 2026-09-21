/* MC Plan offline shell. The build injects the exact asset list and its hash. */
const PREFIX = `mc-plan:${self.registration.scope}:`;
const BUILD = 'development'; // __BUILD_ID__
const CACHE = PREFIX + BUILD;
const ASSETS = []; // __PRECACHE__
const scopeURL = new URL(self.registration.scope);
const indexURL = new URL('index.html', scopeURL).href;

self.addEventListener('install', event => {
  // A partial installation is never activated. Existing tabs keep their version.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new URL(path, scopeURL).href))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scopeURL.origin || !url.pathname.startsWith(scopeURL.pathname)) return;
  if (request.mode === 'navigate') {
    // HTML and JS always come from the same build, including after a deployment.
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(indexURL)) || fetch(request)));
    return;
  }
  if (ASSETS.some(path => new URL(path, scopeURL).pathname === url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.origin + url.pathname)) || fetch(request)));
  }
});
