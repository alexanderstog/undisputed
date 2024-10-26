import { app } from './firebase-init.js';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, query, where, getDocs, addDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
// Assuming Firebase is already initialized in your project

//const db = getFirestore(app);
// Initialize Firebase Authentication
const auth = getAuth(app);

// Event listener for form submission
document.getElementById('phone-auth-submit').addEventListener('click', async function() {
    const nameInput = document.getElementById('name-input');
    const name = nameInput.value.trim();
    const errorElement = document.getElementById('name-form-error');
    const toaster = document.getElementById('toaster');
    const countdownElement = document.getElementById('countdown');

    if (name === '') {
        // Display an error message if the input is blank
        errorElement.style.display = 'block';
    } else {
        // Hide the error message if it's visible
        errorElement.style.display = 'none';

        try {
            // Get the Firebase ID token
            const user = auth.currentUser;
            if (!user) {
                throw new Error('User not authenticated');
            }
            const idToken = await user.getIdToken();

            // Send the name and ID token to the backend
            const response = await fetch('/save-name', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, idToken })
            });

            if (response.ok) {
                // Show the success toaster message
                toaster.classList.add('show');

                // Start the countdown for redirection
                let countdown = 3;
                const countdownInterval = setInterval(() => {
                    countdown -= 1;
                    countdownElement.textContent = countdown;

                    if (countdown === 0) {
                        clearInterval(countdownInterval);
                        window.location.href = '/chat'; // Redirect to the chat page
                    }
                }, 1000);
            } else {
                console.error('Failed to save name:', await response.text());
            }
        } catch (error) {
            console.error('Error saving name:', error);
        }
    }
});

