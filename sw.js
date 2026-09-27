/**
 * OutlineWriter Mobile - Service Worker
 * バージョン付きキャッシュによるアプリシェルのネットワークファースト配信
 */

const CACHE_NAME = 'outlinewriter-v4';

const APP_SHELL = [
    './',
    './index.html',
    './mobile-styles.css',
    './mobile-script.js',
    './config.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// インストール: アプリシェルをキャッシュ
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// アクティベート: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// フェッチ: ネットワークファースト（同一オリジンのGETのみ処理、オフライン時はキャッシュにフォールバック）
self.addEventListener('fetch', (event) => {
    const request = event.request;

    // GET以外は処理しない
    if (request.method !== 'GET') {
        return;
    }

    // クロスオリジン（googleapis等）はそのまま通す
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response && response.ok && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});
