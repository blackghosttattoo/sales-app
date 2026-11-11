// 폰 알림 받기 전용(화면 저장·캐시는 안 함). 대장이 '폰 알림 켜기'를 눌렀을 때만 등록돼요.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({apiKey: "AIzaSyBTqRIfhUzlsO2YOfaEBlMHWGlLW-R44Z4", authDomain: "tattoo-cream-ecacc.firebaseapp.com", projectId: "tattoo-cream-ecacc", storageBucket: "tattoo-cream-ecacc.firebasestorage.app", messagingSenderId: "692684499045", appId: "1:692684499045:web:c3a10ae76dd8ff418cfe8c"});
firebase.messaging();
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(ws => { for (const w of ws) if ('focus' in w) return w.focus(); return clients.openWindow('./'); })); });
