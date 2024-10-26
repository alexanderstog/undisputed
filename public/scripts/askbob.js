// Import Firebase and Firestore modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';

// Firebase configuration
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
const db = getFirestore(app);
const auth = getAuth(app);

// Variables to determine chat and subChat collection
const chatForm = document.getElementById('bob-chat');
const chatId = chatForm.getAttribute('data-chat-id');
const subId = chatForm.getAttribute('data-sub-id');
const isDirect = chatForm.getAttribute('data-direct') === 'true';
const userDocId = chatForm.getAttribute('data-user-doc-id');
const messagesCollectionPath = isDirect
    ? `chats/${chatId}/subChats/${subId}/private_messages/${userDocId}/messages`
    : `chats/${chatId}/subChats/${subId}/messages`;

// Function to style existing messages based on userDocId
function styleMessages(userDocId) {
    document.querySelectorAll('[data-message-sender]').forEach((messageElement) => {
        if (messageElement.getAttribute('data-message-sender') === userDocId) {
            messageElement.classList.add('message-right');
        }
    });
}

// Function to add a new message to the DOM with styling
function appendMessageToDOM({ content, sender, timestamp, userId, messageId, isSending = false }) {
    const chatWrapper = document.querySelector('.chat-wrapper');
    const responseDiv = document.createElement('div');
    responseDiv.className = `response ${userId === userDocId ? 'message-right' : ''} ${isSending ? 'sending' : ''}`.trim();
    responseDiv.setAttribute('data-message-sender', userId);
    responseDiv.setAttribute('data-message-id', messageId);
    responseDiv.setAttribute('data-message-timestamp', timestamp);

    responseDiv.innerHTML = `
        <p class="message-sender">${sender}</p>
        <span class="message-content">${content}</span>
        <p class="message-time">${new Date(timestamp).toLocaleString()}</p>
    `;
    chatWrapper.appendChild(responseDiv);
    scrollToBottom();
}

// Message sending functionality
async function sendMessage() {
    const messageInput = document.getElementById('message');
    const message = messageInput.value;
    const sender = getCookie('username');
    if (!auth.currentUser) return console.error('No user signed in');

    const tempMessageId = `temp-${Date.now()}`;
    const userId = userDocId;
    const timestamp = Math.floor(new Date().getTime() / 1000);
    // Display message immediately in the DOM
    appendMessageToDOM({ content: message, sender, timestamp, userId: userDocId, isSending: true });

    const payload = { message, chatId, subId, userId, sender, timestamp };
    console.log("payoad", payload);

    try {
        const response = await fetch('/ask-bob', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (result.success) {
            messageInput.value = ""; // Clear input on success
        }
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

// Event listener for send button
document.getElementById('ask-bob-button').addEventListener('click', sendMessage);

// Firestore real-time listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        const chatRef = query(collection(db, messagesCollectionPath), orderBy('timestamp'));

        onSnapshot(chatRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const newMessage = change.doc.data();
                    const newMessageId = change.doc.id;

                    // Remove temporary "sending" message and replace with actual message
                    const existingMessage = document.querySelector(`[data-message-timestamp="${newMessage.timestamp}"]`);
                    if (existingMessage) {
                        existingMessage.remove();
                    }

                    // Append confirmed message to DOM
                    appendMessageToDOM({ ...newMessage, messageId: newMessageId });
                }
            });
        });
    } else {
        signInAnonymously(auth).catch((error) => {
            console.error("Error signing in anonymously:", error);
        });
    }
});

// Scroll to bottom on new message
function scrollToBottom() {
    const chatWrapper = document.querySelector('.chat-wrapper');
    chatWrapper.scrollTop = chatWrapper.scrollHeight;
}

// Helper function to get cookie by name
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}
