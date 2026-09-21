/* MC Plan offline shell. The build injects the exact asset list and its hash. */
const PREFIX = `mc-plan:${self.registration.scope}:`;
const BUILD = '486e3e37a0760a95';
const CACHE = PREFIX + BUILD;
const ASSETS = [".nojekyll","assets/Fristen-DtKpPG4f.js","assets/Funktionen-DES-DZ-X.js","assets/PlanlaufDetail-Da738cXO.js","assets/ProjektDetail-BfLBrpCz.js","assets/SchrittStatus-3uPRH6jP.js","assets/Vorlagen-1V79Q21J.js","assets/Workflows-CZwuqCb7.js","assets/email-CwFgg4z0.js","assets/importVorlagen-BaaN8ZN-.js","assets/index-C2_lq3Rx.js","assets/index-NhJh4wxI.css","assets/inter-latin-wght-normal-Dx4kXJAl.woff2","icon.svg","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","mailaender-consult.svg","manifest.webmanifest"];
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
