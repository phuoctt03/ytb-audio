self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("ytb-app-cache").then(cache => {
      return cache.addAll([
        "./ytb-audio/",
        "./ytb-audio/index.html",
        "./ytb-audio/manifest.json",
        "./ytb-audio/icon.png",
        "./ytb-audio/styles.css",
        "./ytb-audio/script.js"
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
