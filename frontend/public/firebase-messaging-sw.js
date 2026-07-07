importScripts('https://www.gstatic.com/firebasejs/11.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.13.0/firebase-messaging-compat.js');

firebase.initializeApp({"apiKey":"","authDomain":"","projectId":"","messagingSenderId":"","appId":""});
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notification = payload.notification || {};
  const notificationData = payload.data || {};
  self.registration.showNotification(notification.title || 'GYAN RISE RANA', {
    body: notification.body || notificationData.body || '',
    icon: notification.icon || '/favicon.ico',
    data: notificationData,
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === url && 'focus' in client) {
          client.focus();
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});
