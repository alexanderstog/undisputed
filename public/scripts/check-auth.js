import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js';
import { auth } from './firebase-init.js'; // Import from firebaseInit module

function checkUserAuth() {
    console.log("checking auth");
    onAuthStateChanged(auth, (user) => {
        if (user) {
            user.getIdToken().then(token => {
                // Set the token in a cookie
                console.log("this did happen");
                document.cookie = `idToken=${token};path=/;max-age=36000000000`; 
                window.location.href =  '/user';
              });
            console.log("User is loggeding in", user.uid);
            
            // Handle logged-in user
        } else {
            console.log("User is not logged in");
            // Handle non-authenticated user
            document.cookie = "idToken=; Max-Age=-99999999;";
            if (window.location.pathname !== "/") {
                window.location.href = "/getmein";
            }
        }
    });
}

export { checkUserAuth };