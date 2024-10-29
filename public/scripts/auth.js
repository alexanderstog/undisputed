// Import Firebase services
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, deleteDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

// Set persistence to browser local storage
setPersistence(auth, browserLocalPersistence).then(() => {
    console.log("Persistence set to browserLocalPersistence.");
}).catch((error) => {
    console.error("Error setting persistence:", error);
});

function resetGetVerificationButton() {
    const phoneSubmitButton = document.getElementById('phone-auth-submit');
    phoneSubmitButton.classList.remove('disabled', 'loading');
    phoneSubmitButton.textContent = 'Get verification code';
}

function resetVerificationCodeForm(){
    //const codeInput = document.getElementById('verification-code');
    const codeInputButton = document.getElementById('otp-auth');
    codeInputButton.classList.remove('disabled', 'loading');
    //codeInput.textContent = '';
    codeInputButton.textContent = 'Verify code';
}

let confirmationResult;
let recaptchaVerifier;

// Initialize reCAPTCHA
export function initializeRecaptcha() {
    console.log("Initializing reCAPTCHA");

    const rawPhoneNumber = document.getElementById('phone-number').value;
    let processedPhoneNumber = rawPhoneNumber.startsWith('0') ? rawPhoneNumber.substring(1) : rawPhoneNumber;
    const selectedValue = document.getElementById('region-select').value;
    const phoneNumber = selectedValue + processedPhoneNumber;
    console.log("Phone number is:", phoneNumber);

    if (!recaptchaVerifier) {
        recaptchaVerifier = new RecaptchaVerifier(auth, 'phone-auth-submit', {
            size: 'invisible',
            callback: () => console.log('reCAPTCHA resolved.'),
            'expired-callback': () => {
                resetGetVerificationButton();
                grecaptcha.reset();
            }
        });
    } else {
        grecaptcha.reset();
    }

    signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier).then((result) => {
        confirmationResult = result;
        console.log("SMS sent. Please check your phone for the verification code.");
        document.getElementById('phone-form').style.display = 'none';
        document.getElementById('verification-code-form').style.display = 'block';
    }).catch((error) => {
        const phoneFormError = document.getElementById('phone-form-error');
        phoneFormError.textContent = `Error sending SMS: ${error.message}`;
        phoneFormError.style.display = 'block';
        console.error("Error sending SMS:", error);
        resetGetVerificationButton();
        grecaptcha.reset();
    });
}

// Verify OTP code
export async function verifyCode() {
    const code = document.getElementById('verification-code').value;
    const verifyCodeButton = document.getElementById('otp-auth');
    verifyCodeButton.classList.add('loading');
    verifyCodeButton.textContent = "Validating";
    console.log("Confirmation code is:", code);

    try {
        const result = await confirmationResult.confirm(code);
        const user = result.user;
        const authUid = user.uid;
        const phoneNumber = user.phoneNumber;
        console.log("Authenticated phone number:", phoneNumber);

        // Locate the source document based on phone number
        const usersCollectionRef = collection(db, "users");
        const q = query(usersCollectionRef, where('phone', '==', phoneNumber));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const sourceDoc = querySnapshot.docs[0];
            const sourceDocId = sourceDoc.id;
            console.log("Source document ID:", sourceDocId);

            // If source document ID differs from auth UID, copy to new document with auth UID as ID
            if (sourceDocId !== authUid) {
                console.log("Source document differs from auth UID. Proceeding with copy.");
                await copyUserDocument(sourceDoc.ref, doc(db, 'users', authUid));
                console.log("User document and subcollections copied successfully.");
                
                // Delete old document if desired
                await deleteDoc(sourceDoc.ref);
                console.log("Old user document deleted.");
            } else {
                console.log("User document ID matches auth UID. No copy needed.");
            }
        } else {
            // If no matching user found, create a new document with auth UID as ID
            console.log("No matching user found. Creating new document with auth UID.");
            await setDoc(doc(db, 'users', authUid), { phone: phoneNumber, createdAt: new Date() });
            console.log("New user document created.");
        }

        // Set token and redirect as usual
        const token = await user.getIdToken();
        const response = await fetch('/set-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token })
        });

        if (response.ok) {
            window.location.href = '/user';
        } else {
            console.error('Failed to set token on the server');
        }
    } catch (error) {
        console.error("Error during verification or copy:", error);
        resetVerificationCodeForm();
        const otpFormError = document.getElementById('otp-form-error');
        otpFormError.textContent = `Error sending SMS: ${error.message}`;
        otpFormError.style.display = 'block';
    }
}

// Helper function to copy user document and its subcollections
async function copyUserDocument(sourceDocRef, targetDocRef) {
    try {
        // Copy main document data
        const sourceDocData = (await getDoc(sourceDocRef)).data();
        await setDoc(targetDocRef, sourceDocData);
        
        // Copy personas subcollection and nested subChats for each persona
        const personasCollection = collection(sourceDocRef, 'personas');
        const personasSnapshot = await getDocs(personasCollection);
        for (const personaDoc of personasSnapshot.docs) {
            const personaData = personaDoc.data();
            const targetPersonaDocRef = doc(targetDocRef, 'personas', personaDoc.id);
            await setDoc(targetPersonaDocRef, personaData);

            // Copy each subChat in this persona
            const subChatsCollection = collection(personaDoc.ref, 'subChats');
            const subChatsSnapshot = await getDocs(subChatsCollection);
            for (const subChatDoc of subChatsSnapshot.docs) {
                const subChatData = subChatDoc.data();
                const targetSubChatDocRef = doc(targetPersonaDocRef, 'subChats', subChatDoc.id);
                await setDoc(targetSubChatDocRef, subChatData);
            }
        }
        console.log("User document and subcollections copied successfully.");
    } catch (error) {
        console.error("Error copying user document:", error);
    }
}
