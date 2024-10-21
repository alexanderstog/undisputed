import { app } from './firebase-init.js';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Initialize Firebase Authentication
const auth = getAuth(app);

let confirmationResult;

// Function to initialize reCAPTCHA
export function initializeRecaptcha() {
  console.log("initializing recapthca");
  const rawPhoneNumber = document.getElementById('phone-number').value;
  let processedPhoneNumber = rawPhoneNumber;

// Check if the first character is '0' and remove it if true
  if (rawPhoneNumber.startsWith('0')) {
    processedPhoneNumber = rawPhoneNumber.substring(1);
  }
  const regionSelect = document.getElementById('region-select');

    // Get the selected value
    const selectedValue = regionSelect.value;
    
    console.log("Selected dialing code:", selectedValue);

    // You can also attach an event listener to track changes
    regionSelect.addEventListener('change', function() {
        const selectedValue = this.value; // Get the new value when changed
        console.log("New selected dialing code:", selectedValue);
    });
  const phoneNumber = selectedValue + processedPhoneNumber;  
  console.log("phone number is", phoneNumber);

  
  const recaptchaVerifier = new RecaptchaVerifier(auth, 'phone-auth-submit', {
      size: 'invisible',
      callback: () => {
          console.log('reCAPTCHA resolved..');
      },
      'expired-callback': () => {
          console.log("reCAPTCHA expired, resetting...");
          grecaptcha.reset();  // Reset reCAPTCHA when it expires
      }
  });

  signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier)
      .then((result) => {
        console.log("wtf is going on");
          confirmationResult = result;
          console.log("SMS sent. Please check your phone for the verification code.");
          document.getElementById('phone-form').style.display = 'none';
          document.getElementById('verification-code-form').style.display = 'block';
      })
      .catch((error) => {
          const phoneFormError = document.getElementById('phone-form-error');
          phoneFormError.textContent = `Error sending SMS: ${error.message}`;
          phoneFormError.style.display = 'block';
          console.error("Error sending SMS:", error);
          grecaptcha.reset();
      });
}


// Function to verify the OTP code
export function verifyCode() {
    const code = document.getElementById('verification-code').value;
    console.log("Confirmation code is:", code);

    confirmationResult.confirm(code)
        .then((result) => {
            console.log("User signed in successfully:", result.user);
            
            // Get the idToken and send it to the server to set the cookie
            result.user.getIdToken().then(token => {
                console.log("Token received, sending to server...");

                // Send the token to the server via POST request
                fetch('/set-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ idToken: token })
                })
                .then(response => {
                    if (response.ok) {
                        window.location.href = '/user'; // Redirect to the user page after successful login
                    } else {
                        console.error('Failed to set token on the server');
                    }
                })
                .catch(error => {
                    console.error("Error sending token to server:", error);
                });
            }).catch(error => {
                console.error("Error getting token:", error);
            });
        })
        .catch((error) => {
            console.error("Error verifying SMS code:", error);
        });
}
