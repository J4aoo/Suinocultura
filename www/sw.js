/* ==========================================================================
   sw.js — service worker do app Granja Suína
   - Guarda a "casca" do aplicativo para abrir rápido / sem internet.
   - NUNCA guarda as chamadas da Table API (tables/…): dados sempre da rede.
   ========================================================================== */
const VERSAO = 'granja-v1';
const CACHE = 'granja-' + VERSAO;

const CASCA = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/api.js',
  './js/ui.js',
  './js/analytics.js',
  './js/views.js',
  './js/views-repro.js',
  './js/views-mgmt.js',
  './js/app.js',
  './js/pwa.js',
  './vendor/chart.umd.min.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Guarda item por item: uma falha não impede a instalação.
    await Promise.all(CASCA.map(async (url) => {
      try { await cache.add(new Request(url, { cache: 'reload' })); } catch (_) { /* ignora */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

function ehApiTabelas(url) {
  const p = new URL(url).pathname;
  return p.indexOf('/tables/') >= 0 || p.indexOf('/hosted/') >= 0 || p.indexOf('/api/') >= 0;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Dados da granja: sempre rede, nunca do cache.
  if (ehApiTabelas(req.url)) return;

  // Navegação (abrir o app): rede primeiro, cache como reserva offline.
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch (_) {
        const cache = await caches.open(CACHE);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Scripts, estilos, fontes e ícones: serve do cache e atualiza em segundo plano.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardado = await cache.match(req, { ignoreSearch: false });

    const rede = fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
        return res;
      })
      .catch(() => null);

    if (guardado) { rede; return guardado; }
    const resposta = await rede;
    if (resposta) return resposta;
    return new Response('', { status: 504, statusText: 'Sem conexão' });
  })());
});
