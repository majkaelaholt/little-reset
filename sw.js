const CACHE_NAME = "little-reset-v1-20260630";
const ASSETS = ["./", "./index.html", "./styles.css", "./styles.css?v=20260630", "./app.js", "./app.js?v=20260630", "./manifest.webmanifest", "./manifest.webmanifest?v=20260630", "./icon.svg"];

self.addEventListener("install", function(event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
    return cache.addAll(ASSETS);
  }));
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(key) {
      return key !== CACHE_NAME;
    }).map(function(key) {
      return caches.delete(key);
    }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function(event) {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(function(cached) {
    return cached || fetch(event.request).then(function(response) {
      var copy = response.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(event.request, copy);
      });
      return response;
    }).catch(function() {
      return caches.match("./index.html");
    });
  }));
});
