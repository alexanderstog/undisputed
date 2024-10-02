import { getAuth, signOut } from 'https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js';



export signOut(auth).then(() => {
  // Sign-out successful.
}).catch((error) => {
  // An error happened.
});

