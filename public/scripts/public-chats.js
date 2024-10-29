// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, collectionGroup, query, doc, where, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Fetch and display public subchats
async function fetchAndDisplayPublicChats() {
    console.log("Fetching public chats and subchats...");

    try {
        const publicChatsContainer = document.getElementById('public-chats-container');
        if (!publicChatsContainer) {
            console.error("Element with ID 'public-chats-container' not found");
            return;
        }
         // Clear previous content

        const currentUser = document.body.getAttribute('data-user-id');
        if (!currentUser) {
            console.error("No user ID available to fetch public chats.");
            return;
        }

        // Fetch public chats from /get-public-chats endpoint using POST
        const response = await fetch('/public-chats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: currentUser })
        });

        if (!response.ok) {
            console.error("Error fetching public chats:", response.statusText);
            return;
        }
        publicChatsContainer.innerHTML = '';
        const subChats = await response.json();
        console.log("Number of matching subChats:", subChats.length);
        
        // Process and display each subChat
        subChats.forEach(subChat => {

            
            
            const { id, parentChatId, ...subChatData } = subChat;
            console.log("iddddddddddddddd", id);
            
            console.log("Parent Chat ID:", parentChatId);
            console.log("SubChat Data:", subChatData);

            if (!document.querySelector(`[data-sub-chat-id="${parentChatId}${id}"]`)) {
            
            const subChatItem = document.createElement('div');
            subChatItem.innerHTML = `
                <a href="/chat/${parentChatId}/${id}">
                    <div data-sub-chat-id="${parentChatId}${id}" class="chat-item chat-item-public">
                        <div class="chat-logo" style="background-image: url('/img/${subChatData.img || 'default.png'}')">&nbsp;</div>
                        <div class="chat-info">
                            <div class="chat-name">${subChatData.group_name || 'Unnamed SubChat'}</div>
                            <p style="margin-bottom:0px!important; text-align:left;">
                                <span style="font-size:0.8rem; margin-bottom:0px!important;"></span>${subChatData.persona || ''}
                            </p>
                            <div class="chat-description">${subChatData.description || ''}</div>
                        </div>
                    </div>
                </a>
            `;
            publicChatsContainer.appendChild(subChatItem);
            }
            // Rest of your display code goes here...
        });

    } catch (error) {
        console.error("Error fetching public chats:", error);
    }
}

// Call the function when the page loads
document.addEventListener('DOMContentLoaded', fetchAndDisplayPublicChats);


// Call the function when the page loads
document.addEventListener('DOMContentLoaded', fetchAndDisplayPublicChats);


