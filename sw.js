/**
 * OutlineWriter Mobile - Service Worker
 * バージョン付きキャッシュによるアプリシェルのキャッシュファースト配信
 */

const CACHE_NAME = 'outlinewriter-v1';

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

// フェッチ: キャッシュファースト（同一オリジンのGETのみ処理）
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
        caches.match(request).then((cached) => {
            return cached || fetch(request);
        })
    );
});
