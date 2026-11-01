importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyD2JFoeUYOpAWEKuteX7TAkd6KdFtv4WOU",
  authDomain: "gadget-store-4d442.firebaseapp.com",
  projectId: "gadget-store-4d442",
  storageBucket: "gadget-store-4d442.firebasestorage.app",
  messagingSenderId: "292909971795",
  appId: "1:292909971795:web:109f2e0479c6c4a89249a6",
  measurementId: "G-K1B26N9XH8",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle =
    payload.notification?.title || "Gadget Store";

  const notificationOptions = {
    body:
      payload.notification?.body || "You have received a new order.",
    icon: "/favicon.ico",
    data: payload.data || {},
  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});