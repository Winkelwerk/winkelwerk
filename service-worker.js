const CACHE_NAME = "winkelwerk-shell-v4";
const DB_NAME = "winkelwerk-inbox";
const STORE_NAME = "messages";
const MAX_MESSAGES = 40;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./winkelwerlk.png",
  "./menü/",
  "./inbox/",
  "./admin/"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (requestUrl.pathname.endsWith("/app-config.js")) {
    event.respondWith(fetch(request));
    return;
  }

  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.includes("/functions/v1/push-api/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(async () => {
        const cached = await caches.match(request);
        return cached || caches.match("./index.html");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }

        return response;
      });
    })
  );
});

function openInboxDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("sentAt", "sentAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllMessages() {
  const db = await openInboxDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = request.result.sort((left, right) => {
        return String(right.sentAt).localeCompare(String(left.sentAt));
      });

      resolve(items);
    };

    request.onerror = () => reject(request.error);
  });
}

async function trimMessages() {
  const db = await openInboxDb();
  const allMessages = await getAllMessages();
  const itemsToDelete = allMessages.slice(MAX_MESSAGES);

  if (!itemsToDelete.length) {
    return;
  }

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    itemsToDelete.forEach((item) => {
      store.delete(item.id);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function saveMessage(message) {
  const db = await openInboxDb();
  const defaultUrl = new URL("./inbox/", self.registration.scope).href;
  const payload = {
    id: message.id || "msg-" + Date.now(),
    title: message.title || "Winkelwerk",
    body: message.body || "",
    url: message.url || defaultUrl,
    sentAt: message.sentAt || new Date().toISOString(),
    source: message.source || "push"
  };

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(payload);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  await trimMessages();
}

async function clearMessages() {
  const db = await openInboxDb();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function broadcastMessagesUpdated() {
  const clientsList = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window"
  });

  clientsList.forEach((client) => {
    client.postMessage({ type: "INBOX_UPDATED" });
  });
}

self.addEventListener("message", (event) => {
  const { data } = event;

  if (!data || typeof data !== "object") {
    return;
  }

  if (data.type === "SAVE_INBOX_MESSAGE") {
    event.waitUntil(
      saveMessage(data.payload).then(() => broadcastMessagesUpdated())
    );
    return;
  }

  if (data.type === "CLEAR_INBOX_MESSAGES") {
    event.waitUntil(
      clearMessages().then(() => broadcastMessagesUpdated())
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    id: "push-" + Date.now(),
    title: "Winkelwerk",
    body: "Du hast eine neue interne Nachricht.",
    url: new URL("./inbox/", self.registration.scope).href,
    sentAt: new Date().toISOString(),
    source: "push"
  };

  if (event.data) {
    try {
      payload = {
        ...payload,
        ...event.data.json()
      };
    } catch (error) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    saveMessage(payload)
      .then(() => broadcastMessagesUpdated())
      .then(() =>
        self.registration.showNotification(payload.title, {
          body: payload.body,
          icon: "./apple-touch-icon.png",
          badge: "./icon-192.png",
          data: {
            url: payload.url || "./inbox/",
            messageId: payload.id
          }
        })
      )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || "./inbox/",
    self.registration.scope
  ).href;

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
