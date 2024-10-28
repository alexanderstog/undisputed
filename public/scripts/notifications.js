
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';

const firebaseConfig = {
    apiKey: "AIzaSyCoBsK5DUyhNfldFt5HLK27JhbfmkpOe_c",
    authDomain: "undisputed-2fe24.firebaseapp.com",
    databaseURL: "https://undisputed-2fe24-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "undisputed-2fe24",
    storageBucket: "undisputed-2fe24.appspot.com",
    messagingSenderId: "999133750536",
    appId: "1:999133750536:web:7de4c28292e6160c0078bd",
    measurementId: "G-0955YWVR7J"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

async function requestNotificationPermission() {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        const token = await getToken(messaging, { vapidKey: 'YOUR_PUBLIC_VAPID_KEY' });
        if (token) {
            await fetch('/set-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, userId: "USER_ID" }),  // Replace with actual user ID
            });
        }
    } else {
        console.error('Notification permission not granted');
    }
}

// Request permission for notifications when loading
requestNotificationPermission();

onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
    // Optionally display a notification or update the UI
});
