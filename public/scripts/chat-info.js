// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
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

document.addEventListener('DOMContentLoaded', function() {
    // Bootstrap modal instance
    const chatInfoModal = new bootstrap.Modal(document.getElementById('chat-info-modal'));

    // Event listener for the button to open the modal
    //const leaveChatButton = document.getElementById('leave-group-info');
    const chatInfoButton = document.getElementById('chat-info-button');
    if (chatInfoButton) {
        chatInfoButton.addEventListener('click', async () => {
            console.log("show details");
            // Open the modal
            chatInfoModal.show();

            // Fetch and display chat metadata
            const chatId = document.getElementById('bob-chat').getAttribute('data-chat-id');
            const subId = document.getElementById('bob-chat').getAttribute('data-sub-id');

            // Firestore: Reference to subChat document
            const subChatDocRef = doc(db, 'chats', chatId, 'subChats', subId);

            try {
                const subChatDoc = await getDoc(subChatDocRef);

                if (subChatDoc.exists()) {
                    const subChatData = subChatDoc.data();

                    // Populate the modal with subChat metadata
                    document.getElementById('group_name_input').value = subChatData.group_name;
                    document.getElementById('participants_list').innerHTML = subChatData.participants
                        .map(participant => `<li>${participant}</li>`).join('');
                } else {
                    console.error("SubChat document not found");
                }
            } catch (error) {
                console.error("Error fetching subChat data:", error);
            }
        });
    } else {
        console.error("Chat info button not found");
    }

    // Event listener to save group info
    const saveGroupInfoButton = document.getElementById('save-group-info');
    if (saveGroupInfoButton) {
        saveGroupInfoButton.addEventListener('click', async () => {
            const newGroupName = document.getElementById('group_name_input').value;
            const chatId = document.getElementById('bob-chat').getAttribute('data-chat-id');
            const subId = document.getElementById('bob-chat').getAttribute('data-sub-id');

            // Firestore: Reference to subChat document
            const subChatDocRef = doc(db, 'chats', chatId, 'subChats', subId);

            try {
                // Update the group name in Firestore
                await updateDoc(subChatDocRef, { group_name: newGroupName });
                console.log("Group name updated successfully");

                // Hide the modal after saving
                chatInfoModal.hide();
            } catch (error) {
                console.error("Error updating group name:", error);
            }
        });
    } else {
        console.error("Save group info button not found");
    }

    const leaveChatButton = document.getElementById('leave-group-info');
    if (leaveChatButton) {
        leaveChatButton.addEventListener('click', async () => {
        const chatId = document.getElementById('bob-chat').getAttribute('data-chat-id');
        const subId = document.getElementById('bob-chat').getAttribute('data-sub-id');
        window.location.href = `/leavegroup/${chatId}/${subId}`;
        });
    } else {
        console.error("Save group info button not found");
    }


});
