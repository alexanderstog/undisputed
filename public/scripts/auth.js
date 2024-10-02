import { app } from './firebase-init.js';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

/* const firebaseConfig = {
    apiKey: "AIzaSyCoBsK5DUyhNfldFt5HLK27JhbfmkpOe_c",
    authDomain: "undisputed-2fe24.firebaseapp.com",
    databaseURL: "https://undisputed-2fe24-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "undisputed-2fe24",
    storageBucket: "undisputed-2fe24.appspot.com",
    messagingSenderId: "999133750536",
    appId: "1:999133750536:web:7de4c28292e6160c0078bd",
    measurementId: "G-0955YWVR7J"
  };
*/


// const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

let confirmationResult; 

/*
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    // Now, any future sign-in will persist in the local storage and keep the session
    console.log("Persistence set to local");
  })
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });
  
// window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {});
*/

/* window.recaptchaVerifier = new RecaptchaVerifier("phone-auth-submit", {
    'callback': (response) => {
      console.log("prepared phone auth process");
    }
  }, auth);
*/



// Function to initialize reCAPTCHA
export function initializeRecaptcha() {
    console.log("initializing recapthca");
    const rawPhoneNumber = document.getElementById('phone-number').value;
    console.log("raw phone is" + rawPhoneNumber);
    const processedPhoneNumber = rawPhoneNumber.substring(1);
    const phoneNumber = "+44" + processedPhoneNumber;  
    console.log("phone number is", phoneNumber);
    console.log("is this an error", RecaptchaVerifier);
    const recaptchaVerifier = new RecaptchaVerifier(auth, 'phone-auth-submit', {
        size: 'invisible',
        callback: () => {
            console.log('recaptcha resolved..')
        } ,
        'expired-callback': () => {
          console.log("recapthca callback fuckery");
          grecaptcha.reset();
          // ...
        }
    });
    

    
       


    signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier)
        .then((result) => {
            confirmationResult = result;
            console.log("SMS sent. Please check your phone for the verification code.");
            document.getElementById('phone-form').style.display = 'none';
            document.getElementById('verification-code-form').style.display = 'block';
        })
        .catch((error) => {

          const phoneFormError = document.getElementById('phone-form-error');
          phoneFormError.textContent = `Error sending SMS: ${error.message}`;
          phoneFormError.style.display = 'block';
          console.log("error here >>> wtag");
          
          grecaptcha.reset();
                  

          
        });
}


export function verifyCode() {
  const code = document.getElementById('verification-code').value;
  console.log("confirmation code is >>>>>>>", code);
  confirmationResult.confirm(code)
      .then((result) => {
          console.log("User signed in successfully:", result.user);
          // Now get the token and set the cookie
          result.user.getIdToken().then(token => {
              console.log("Token received and setting cookie");
              document.cookie = `idToken=${token};path=/;max-age=36000000000`;
              window.location.href = '/user';
          }).catch(error => {
              console.error("Error getting token:", error);
          });
      })
      .catch((error) => {
          console.error("Error verifying SMS code:", error);
          // Optionally handle a redirect here if needed
      });
}

