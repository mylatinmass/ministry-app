self.addEventListener("push", (event) => {
  let notification = {
    title: "Upcoming ministry assignment",
    body: "Open the Ministry app to review your assignment.",
    url: "/ministry/",
    tag: "ministry-reminder",
  }

  if (event.data) {
    try {
      notification = { ...notification, ...event.data.json() }
    } catch {
      // Keep the privacy-safe default notification.
    }
  }

  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: "/ministry/icons/icon-192.png",
      badge: "/ministry/icons/icon-192.png",
      tag: notification.tag,
      data: { url: notification.url },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const destination = new URL(
    event.notification.data?.url || "/ministry/",
    self.location.origin,
  )

  if (
    destination.origin !== self.location.origin ||
    !destination.pathname.startsWith("/ministry/")
  ) {
    destination.pathname = "/ministry/"
    destination.search = ""
    destination.hash = ""
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clients) => {
        const existing = clients.find(
          (client) => new URL(client.url).pathname.startsWith("/ministry/"),
        )
        if (existing) {
          existing.navigate(destination.href)
          return existing.focus()
        }
        return self.clients.openWindow(destination.href)
      },
    ),
  )
})
