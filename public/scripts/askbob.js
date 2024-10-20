// Import Firebase and Firestore modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';

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

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Firebase Auth
const auth = getAuth();

// Monitor authentication state
// Function to add the message-right class to the appropriate messages
function addMessageClassesForCurrentUser() {
    // Ensure the user is authenticated before running this
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.error("No authenticated user found.");
        return;
    }

    // Get the user ID
    const userId = currentUser.uid;

    // Loop through all messages and add the 'message-right' class to those sent by the current user
    document.querySelectorAll('[data-message-sender]').forEach((messageElement) => {
        const sender = messageElement.getAttribute('data-message-sender');
        if (sender === userId) {
            messageElement.classList.add('message-right');
        }
    });
}

// Auth state change listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User is authenticated:", user.uid);
        // Call the function to add the appropriate classes
        addMessageClassesForCurrentUser();
    } else {
        signInAnonymously(auth)
            .then((result) => {
                console.log("User signed in anonymously:", result.user.uid);
                // Call the function again after signing in anonymously
                addMessageClassesForCurrentUser();
            })
            .catch((error) => {
                console.error("Error signing in anonymously:", error);
            });
    }
});


// Get the chatId and anonymous status from the HTML element
const chatForm = document.getElementById('bob-chat');
const chatId = chatForm.getAttribute('data-chat-id');
const isAnonymous = chatForm.getAttribute('data-anonymous') === 'true';  // Check if chat is anonymous

// Initialize Firestore Query Based on Chat's Anonymous Status
let chatRef;
if (isAnonymous) {
    // Anonymous chat: use the private-messages/{userId}/messages collection
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const userId = user.uid;
            chatRef = query(collection(db, `chats/${chatId}/private-messages/${userId}/messages`), orderBy('timestamp'));

            // Listen for real-time updates using Firestore's onSnapshot
            onSnapshot(chatRef, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        handleNewMessage(change.doc);
                    }
                });
            });
        }
    });
} else {
    // Non-anonymous chat: use the public messages collection
    chatRef = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp'));

    // Listen for real-time updates using Firestore's onSnapshot
    onSnapshot(chatRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                handleNewMessage(change.doc);
            }
        });
    });
}

// Function to handle new messages
function handleNewMessage(doc) {
    const newMessage = doc.data();
    const newMessageId = doc.id;
    const existingMessage = document.querySelector(`[data-message-id="${newMessageId}"]`);
    if (!existingMessage) {
        hideDummyMessage();
        const chatWrapper = document.querySelector('.chat-wrapper');
        const responseDiv = document.createElement('div');
        const user = auth.currentUser.uid;
        const newmessageuserid = newMessage.userId;

        responseDiv.className = newmessageuserid === user ? 'response message-right' : 'response';
        responseDiv.setAttribute('data-message-id', newMessageId);

        const senderInfo = document.createElement('p');
        senderInfo.className = 'message-sender';
        senderInfo.textContent = newMessage.sender;
        responseDiv.appendChild(senderInfo);

        const messageContent = document.createElement('span');
        messageContent.className = 'message-content';
        messageContent.textContent = newMessage.content;
        responseDiv.appendChild(messageContent);

        const sendTime = document.createElement('p');
        sendTime.className = 'message-time';
        sendTime.textContent = newMessage.timestamp.toDate().toLocaleString();
        responseDiv.appendChild(sendTime);

        chatWrapper.appendChild(responseDiv);

        // Scroll to the bottom after appending the new message
        scrollToBottom();
    }
}

function showDummyMessage(message) {
    // Get the main element
    const responseElement = document.getElementById('dummy-message');
    const chatWrapper = document.querySelector('.chat-wrapper');
    const messageContent = responseElement.querySelector('.message-content');
    messageContent.textContent = message;
    
    // Detach and move the dummy-message to the end of chat-wrapper
    responseElement.remove();
    chatWrapper.appendChild(responseElement);
    
    responseElement.style.display = 'block';
    scrollToBottom();
}

function hideDummyMessage() {
    // Get the main element
    const responseElement = document.getElementById('dummy-message');
    responseElement.style.display = 'none';
}

// Function to scroll to the bottom of the chat
function scrollToBottom() {
    const chatWrapper = document.querySelector('.chat-wrapper');
    chatWrapper.scrollTop = chatWrapper.scrollHeight;
}

// Function to get cookie by name
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${encodeURIComponent(name)}=`);
    if (parts.length === 2) {
        const cookieValue = parts.pop().split(';').shift();
        return decodeURIComponent(cookieValue);
    }
    return null; // Return null if the cookie doesn't exist
}



// Add message sending functionality
document.getElementById('ask-bob-button').addEventListener('click', async () => {
    const message = document.getElementById('message').value;
    const user = auth.currentUser;
    const sender = getCookie('username');
    console.log("user sends message");

    if (!user) {
        console.error('No user is currently signed in');
        return;
    }
    showDummyMessage(message);
    const userId = user.uid;
    console.log('Current user ID:', userId);

    // Prepare the message payload
    const payload = { message, chatId, userId, sender };

    // Post the message to the server
    try {
        const response = await fetch('/ask-bob', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (result.success) {
            document.getElementById('message').value = "";  // Clear the input field after sending the message
        } else {
            console.error("API call failed: " + result.error);
        }
    } catch (error) {
        console.error("Error sending message:", error);
    }
});

// Form submission using enter key
document.getElementById('ask-bob-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent form from reloading the page
    document.getElementById('ask-bob-button').click();
});

// Scroll to the bottom when the page loads
scrollToBottom();
addMessageClassesForCurrentUser();
