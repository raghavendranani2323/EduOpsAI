// EduOps AI service worker — push notifications + basic offline shell
const CACHE = "eduops-shell-v1";
const SHELL = ["/", "/dashboard", "/students", "/attendance", "/fees", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req).catch(() =>
      caches.match(req).then((cached) => cached || caches.match("/offline.html")),
    ),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: "EduOps AI", body: event.data.text() }; }
  const { title = "EduOps AI", body = "", url = "/dashboard", icon = "/icon-192.png", badge = "/icon-192.png" } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body, icon, badge, data: { url }, tag: payload.tag || "eduops",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
