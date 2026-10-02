// Service worker voor offline herhalen (fase 6).
// - App-bestanden (/_next/static, iconen): eerst uit de cache.
// - /vandaag: eerst het netwerk; zonder verbinding de laatst opgehaalde versie.
//   De wachtrij en voortgang zelf staan in IndexedDB (lib/offline/idb.ts).
// - Andere pagina's zonder verbinding: een korte melding met een link naar /vandaag.
// Server actions (POST), auth en export gaan altijd naar het netwerk.
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const OFFLINE_PAGES = ["/vandaag"];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC, PAGES]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const offlineHtml = `<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · PA Studie</title><body style="font-family:system-ui;padding:2rem;max-width:30rem;margin:auto;line-height:1.5">
<h1>Je bent offline</h1><p>Deze pagina heeft verbinding nodig. Herhalen werkt wel zonder verbinding; je beoordelingen worden opgeslagen zodra je weer online bent.</p>
<p><a href="/vandaag">Naar Vandaag</a></p></body></html>`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode !== "navigate") return;

  const cacheable = OFFLINE_PAGES.includes(url.pathname);
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        // Alleen een echte, ingelogde pagina bewaren (geen doorverwijzing naar /login).
        if (cacheable && res.ok && !res.redirected) {
          const cache = await caches.open(PAGES);
          await cache.put(url.pathname, res.clone());
        }
        return res;
      } catch {
        const cache = await caches.open(PAGES);
        const hit = cacheable ? await cache.match(url.pathname) : undefined;
        return hit ?? new Response(offlineHtml, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
    })(),
  );
});
