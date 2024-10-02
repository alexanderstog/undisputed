const functions = require('firebase-functions');
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.static('public'));

app.use(express.json());

app.set('view engine', 'ejs');
const cookieParser = require('cookie-parser');
app.use(cookieParser());

var admin = require("firebase-admin");

var serviceAccount = require("./serviceAccountKey.json");

const apiUrl = 'https://app.wordware.ai/api/released-app/d1690d10-90bf-4df1-ab5b-793e7f1b12f2/run';

const bearerToken = 'ww-8bCeQAVLTMXeA3FcKOaHcHSzwmW5h7HTM5qz5nriNQF7gW7tDCaROr';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://undisputed-2fe24-default-rtdb.europe-west1.firebasedatabase.app"
});


const db = admin.firestore();





app.get('/', (req, res) => {
  res.render('set-name');
});

app.get('/logout', (req, res) => {
  res.render('logout');
});


function authenticateRequest(req, res, next) {
  
  const token = req.cookies['idToken'];
  if (!token) {
    return res.render('home');
    
  }

  admin.auth().verifyIdToken(token)
    .then(decodedToken => {
      req.user = decodedToken;
      console.log("user authenticated successfully");
      next();
    }).catch(error => {
      console.error('Error verifying token:', error);
      res.clearCookie('idToken');  // Clear the token as it might be invalid/expired
      res.redirect('/');  // Redirect to login page
    });
}

app.post('/send-message', async (req, res) => {
  const { message, todaysdate, name } = req.body;

  try {
      const apiResponse = await callWordwareAPI(message, todaysdate, name);
      res.json({ success: true, data: apiResponse });
  } catch (error) {
      res.status(500).json({ success: false, error: error.message });
  }
});



// Route that requires authentication
/*
app.get('/amiloggedin', (req, res) => {
  res.render('amiloggedin');
  console.log("req body", req.body);
});


app.get('/user', authenticateRequest, (req, res) => {
  const uid = req.user.uid;
  let eventIds; // Declare eventIds at a higher scope

  admin.auth().getUser(uid)
    .then(userRecord => {
      const phoneNumber = userRecord.phoneNumber; // Get the phone number from Auth

      // Now use the phone number to get the corresponding Firestore document
      const userDocRef = db.collection('users').doc(phoneNumber);
      return userDocRef.get();
    })
    .then(userDoc => {
      if (!userDoc.exists) {
        res.status(404).send('User data not found in Firestore');
      } else {
        // Retrieve and store the event IDs in the higher scoped variable
        eventIds = userDoc.data().events;
        console.log("Event IDs are this >>>>>", eventIds);

        // Fetch all event documents based on these IDs
        return Promise.all(eventIds.map(eventId => db.collection('events').doc(eventId).get()));
      }
    })
    .then(eventDocs => {
      const eventsData = eventDocs.map(doc => doc.exists ? doc.data() : null).filter(data => data !== null);
      if (eventsData.length > 1) {
        res.render('myevents', { myevents: JSON.stringify(eventsData) });
      } else if (eventsData.length === 1) {
        console.log("Event IDs AGAIN are this >>>>>", eventIds);
        res.redirect(`/event/${eventIds[0]}`); // Now eventIds is accessible here
      }
    })
    .catch(error => {
      console.error('Error processing your request:', error);
      res.status(500).send('Error fetching user and event information');
    });
});
*/

// competition pages

app.get('/competition', (req, res) => {
  res.render('competition');
});


app.get('/askbob', (req, res) => {
  res.render('askbob');
});

app.get('/set-name', (req, res) => {
  res.render('set-name');
});

app.post('/ask-bob', async (req, res) => {
  const { message, todaysdate, username } = req.body;

  const requestBody = {
      inputs: {
          message: message,
          todaysdate: todaysdate,
          username: username
      },
      version: '^2.14'
  };

  try {
      const response = await axios.post(apiUrl, requestBody, {
          headers: {
              'Authorization': `Bearer ${bearerToken}`,
              'Content-Type': 'application/json',
          }
      });

      const responseData = response.data;

      // Split the response data by newline characters to get individual JSON chunks
      const chunks = responseData.split('\n').filter(chunk => chunk.trim() !== '');

      let finalResponse = '';

      // Loop through each chunk to find the 'outputs' object containing the 'response'
      for (const chunk of chunks) {
          try {
              const parsedChunk = JSON.parse(chunk);
              if (parsedChunk.type === 'chunk' && parsedChunk.value.type === 'outputs') {
                  // Extract the 'response' from the 'new_structured_generation' key
                  finalResponse = parsedChunk.value.values.new_structured_generation.response;
                  break;  // Stop once we find the desired 'response'
              }
          } catch (e) {
              console.error('Error parsing chunk:', e.message);
          }
      }

      if (finalResponse) {
          res.json({ success: true, response: finalResponse });
      } else {
          res.status(500).json({ success: false, error: 'Failed to extract response' });
      }
  } catch (error) {
      res.status(500).json({ success: false, error: error.message });
  }
});





/*
app.get('/event/:eventId', authenticateRequest, (req, res) => {
  const eventId = req.params.eventId;
  console.log("EVENTID IS = ", eventId);
  const user = req.user;
  console.log("user issssss = ", user);

  // Check if the user has access to the event
  db.collection('users').doc(user.phone_number).get()
      .then(userDoc => {
          if (!userDoc.exists) {
              throw new Error('User document not found');
          }
          const userData = userDoc.data();
          if (userData.events && userData.events.includes(eventId)) {
              return db.collection('events').doc(eventId).get();
          } else {
              throw new Error('User does not have access to this event');
          }
      })
      .then(eventDoc => {
          if (!eventDoc.exists) {
              res.status(404).send('Event not found');
          } else {
              res.render('event', {eventId:eventId, eventData: eventDoc.data()});
          }
      })
      .catch(error => {
          console.error('Error:', error);
          res.status(403).send('Access denied');
      });
});


*/







exports.app = functions.https.onRequest(app);

//app.listen(3000);