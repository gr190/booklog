const CACHE_NAME = 'reading-app-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  'https://unpkg.com/@zxing/library@0.19.1',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/placeholder.svg'
];

// インストール時にキャッシュを作成
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('キャッシュを開きました');
        return cache.addAll(urlsToCache);
      })
  );
});

// フェッチイベントをインターセプト
self.addEventListener('fetch', event => {
  // APIリクエストの場合は特別な処理
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetchAndCache(event.request)
        .catch(() => {
          // オフライン時はキャッシュから取得
          return caches.match(event.request)
            .then(response => {
              if (response) {
                return response;
              }
              // キャッシュにもない場合はエラーレスポンスを返す
              return new Response(JSON.stringify({
                error: 'オフラインモードです。このデータはキャッシュされていません。'
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            });
        })
    );
  } else {
    // 通常のリクエスト
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // キャッシュがあればそれを返す
          if (response) {
            return response;
          }
          
          // キャッシュがなければネットワークから取得
          return fetchAndCache(event.request)
            .catch(() => {
              // オフライン時に画像リクエストの場合はプレースホルダーを返す
              if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
                return caches.match('/icons/placeholder.svg');
              }
              
              // HTMLリクエストの場合はオフラインページを返す
              if (event.request.headers.get('Accept').includes('text/html')) {
                return caches.match('/');
              }
            });
        })
    );
  }
});

// ネットワークからフェッチしてキャッシュに保存する関数
function fetchAndCache(request) {
  return fetch(request)
    .then(response => {
      // 有効なレスポンスでなければそのまま返す
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }
      
      // レスポンスをクローンしてキャッシュに保存
      const responseToCache = response.clone();
      
      caches.open(CACHE_NAME)
        .then(cache => {
          cache.put(request, responseToCache);
        });
        
      return response;
    });
}

// バックグラウンド同期
self.addEventListener('sync', event => {
  if (event.tag === 'sync-reading-records') {
    event.waitUntil(syncReadingRecords());
  }
});

// 読書記録を同期する関数
function syncReadingRecords() {
  // ここでは単純にキャッシュを更新するだけ
  return caches.open(CACHE_NAME)
    .then(cache => {
      return cache.addAll(urlsToCache);
    });
}

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});