// EduOps AI service worker — push only, no fetch interception
// (Fetch interception was causing perceived nav lag on the admin app.
//  Push notifications still work without it.)

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: "EduOps AI", body: event.data.text() }; }
  const { title = "EduOps AI", body = "", url = "/dashboard", icon = "/icon-192.svg", badge = "/icon-192.svg", tag = "eduops" } = payload;
  event.waitUntil(
    self.registration.showNotification(title, { body, icon, badge, data: { url }, tag }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) { c.navigate?.(url); return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
