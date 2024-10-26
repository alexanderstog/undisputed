// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, collection, doc, getDocs, query, where, FieldPath } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
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

// Function to fetch and display public chats and subchats
async function fetchAndDisplayPublicChats() {
    try {
        console.log("Fetching public chats and subchats...");
        
        // Select the container element and ensure it exists
        const publicChatsContainer = document.getElementById('public-chats-container');
        if (!publicChatsContainer) {
            console.error("Element with ID 'public-chats-container' not found");
            return;
        }
        publicChatsContainer.innerHTML = ''; // Clear previous content

        // Fetch main chat documents
        const chatsRef = collection(db, 'chats');
        const chatsSnapshot = await getDocs(chatsRef);

        // Process each chat document
        for (const chatDoc of chatsSnapshot.docs) {
            const chatData = chatDoc.data();
            const chatId = chatDoc.id;
            console.log("Chat Metadata:", chatData, "Chat ID:", chatId);

            // Reference for subChats within the current chat
            const subChatsRef = collection(db, 'chats', chatId, 'subChats');
            const subChatsQuery = query(subChatsRef, where('group', '==', true)); 
            const subChatsSnapshot = await getDocs(subChatsQuery);

            // Check if there are any matching subChats
            const subChats = subChatsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // If there are matching subChats, display each subChat
            subChats.forEach(subChat => {
                const subChatIdValue = `${chatId}${subChat.id}`;

                // Check if an element with this specific data-sub-chat-id already exists
                if (!document.querySelector(`[data-sub-chat-id="${subChatIdValue}"]`)) {
                    const subChatItem = document.createElement('div');
                    subChatItem.innerHTML = `
                        <a href="/chat/${chatId}/${subChat.id}">
                            <div data-sub-chat-id="${subChatIdValue}" class="chat-item chat-item-public">
                                <div class="chat-logo" style="background-image: url('/img/${subChat.img || chatData.img}')">&nbsp;</div>
                                <div class="chat-info">
                                    <div class="chat-name">${subChat.group_name || 'Unnamed SubChat'}</div>
                                    <div class="chat-description">${subChat.description || ''}</div>
                                </div>
                            </div>
                        </a>
                    `;
                    publicChatsContainer.appendChild(subChatItem);
                } else {
                    console.log(`Sub-chat with ID ${subChatIdValue} already exists, skipping.`);
                }
            });
        }
    } catch (error) {
        console.error("Error fetching public chats:", error);
        setTimeout(fetchAndDisplayPublicChats, 5000);
    }
}

// Call the function when the page loads
document.addEventListener('DOMContentLoaded', fetchAndDisplayPublicChats);