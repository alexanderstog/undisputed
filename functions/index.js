const functions = require('firebase-functions');
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.static('public'));

app.use(express.json());


//webhooks for chat.
const http = require('http');
const socketIo = require('socket.io');
// Create HTTP server and attach socket.io
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Enable CORS for all origins if needed
    methods: ["GET", "POST"]
  },
  transports: ['polling']
}); // Attach Socket.io to the server




app.set('view engine', 'ejs');
const cookieParser = require('cookie-parser');
app.use(cookieParser());

var admin = require("firebase-admin");


var serviceAccount = require("./serviceAccountKey.json");

//wordware config
//maybe I need to move this to the individual chats? 
/*
const apiUrl = 'https://app.wordware.ai/api/released-app/d1690d10-90bf-4df1-ab5b-793e7f1b12f2/run';
const bearerToken = 'ww-8bCeQAVLTMXeA3FcKOaHcHSzwmW5h7HTM5qz5nriNQF7gW7tDCaROr';
*/

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://undisputed-2fe24-default-rtdb.europe-west1.firebasedatabase.app"
});


const db = admin.firestore();


// create connection for each user
// Listen for new connections
/*io.on('connection', (socket) => {
  console.log('>>>>>>>>>> New client connected faaaaaacccccckk');

  // Listen for the client to join a specific chat room
  socket.on('joinChat', async (chatId) => {
    console.log(`>>>>>>>. Client joined chat: ${chatId}`);

    // Set up Firestore real-time listener for this chat
    const chatRef = db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp');
    
    const unsubscribe = chatRef.onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          // Send the new message to the client
          const newMessage = change.doc.data();
          socket.emit('newMessage', newMessage);
          console.log(">>>>>>>> new message added");
        }
      });
    });

    // Handle the client disconnecting
    socket.on('disconnect', () => {
      console.log(`Client disconnected from chat: ${chatId}`);
      unsubscribe(); // Unsubscribe from the Firestore listener when the client disconnects
    });
  });
});
*/


app.get('/', (req, res) => {
  res.redirect('/user');
});

app.get('/logout', (req, res) => {
  
  res.render('logout');
});

app.post('/logout', (req, res) => {
  // Clear the idToken cookie
  res.clearCookie('__session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Ensure secure flag is used in production
      sameSite: 'Lax',
  });

  // Respond with success
  res.status(200).send('Logged out successfully');
});


function authenticateRequest(req, res, next) {
  
  const token = req.cookies['__session'];
  if (!token) {
    return res.render('getmein', { page: 'dashboard' });
    //res.send("what the fuck");
  }

  admin.auth().verifyIdToken(token)
    .then(decodedToken => {
      req.user = decodedToken;
      console.log("user authenticated successfully");

      // Query Firestore for the user document
      return db.collection('users').doc(decodedToken.uid).get();
    })
    .then(userDoc => {
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.chats && Array.isArray(userData.chats)) {
          req.user.accessibleChats = userData.chats;
          console.log("User has access to chats:", req.user.accessibleChats);
        } else {
          req.user.accessibleChats = [];
          console.log(">>>>>>>User has no accessible chats");
        }
      } else {
        //console.log(">>>>>>>User document not found in Firestore");
        req.user.accessibleChats = [];
      }
      console.log("Accessible chats for user:", req.user.accessibleChats);
      next();
    })
    .catch(error => {
      console.error('Error verifying token:', error);
      res.clearCookie('__session');  // Clear the token as it might be invalid/expired
      res.redirect('/banana');  // Redirect to login page
    });
}

function authenticateChat(req, res, next) {
  
  const token = req.cookies['__session'];
  console.log(">>>>authChat token" + token);
  if (!token) {
    return res.render('getmein', { message: 'You need to login before you can access this page.' });
  }

  admin.auth().verifyIdToken(token)
    .then(decodedToken => {
      req.user = decodedToken;
      console.log(">>>>authChat token user authenticated successfully");
      console.log(">>>>authChat decoded uid" + decodedToken.uid);
      // Query Firestore for the user document
      return db.collection('users').doc(decodedToken.uid).get();
    })
    .then(userDoc => {
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.chats && Array.isArray(userData.chats)) {
          req.user.accessibleChats = userData.chats;
          // Check if the requested chat ID is in the user's accessible chats
          const requestedChatId = req.params.id;
          if (requestedChatId && !userData.chats.includes(requestedChatId)) {
            console.log(`User does not have access to chat: ${requestedChatId}`);
            return res.status(403).send('Access denied to this chat');
          }
          console.log("User has access to chats:", req.user.accessibleChats);
        } else {
          req.user.accessibleChats = [];
          console.log(">>>>>>>User has no accessible chats");
        }
      } else {
        console.log(">>>>>>>User document not found in Firestore");
        req.user.accessibleChats = [];
      }
      console.log("Accessible chats for user:", req.user.accessibleChats);
      next();
    })
    .catch(error => {
      console.error('Error verifying token:', error);
      res.clearCookie('__session');  // Clear the token as it might be invalid/expired
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

app.post('/set-token', (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).send('No token provided');
  }

  // Set the cookie securely server-side
  res.cookie('__session', idToken, {
    httpOnly: true,      // Prevent JavaScript access
    secure: process.env.NODE_ENV === 'production',  // Only use Secure in production
    maxAge: 2 * 24 * 60 * 60 * 1000,     // 1 hour expiration
    sameSite: 'Lax'      // Prevent CSRF in some cases
  });

  res.status(200).send('Token set successfully');
});



// login

app.get('/getmein', (req, res) => {
  res.render('getmein');
  //console.log("req body", req.body);
});






// a user's 'homepage'
// need to get all 
app.get('/chat', authenticateRequest, (req, res) => {
  const uid = req.user.uid;
  console.log("User UID:", uid);

  let username;
  let phoneNumber;

  // Identify the user so we can get the chats
  admin.auth().getUser(uid)
    .then(userRecord => {
      phoneNumber = userRecord.phoneNumber;
      console.log("User's phone number:", phoneNumber);

      // Query Firestore for a document where the 'phone' field matches phoneNumber
      return db.collection('users')
        .where('phone', '==', phoneNumber)
        .limit(1)
        .get();
    })
    .then(querySnapshot => {
      if (!querySnapshot.empty) {
        const userDocId = querySnapshot.docs[0].id;
        console.log('User Document ID:', userDocId);
        return userDocId; // Return the userDocId to the next .then()
      } else {
        console.log('No matching documents found');
        return null; // Return null if no document is found
      }
    })
    .then(userDocId => {
      if (!userDocId) {
        console.log("Creating new user document for phone:", phoneNumber);
        return db.collection('users').add({
          phone: phoneNumber,
          createdAt: new Date(),
          name: 'Anonymous' // Default name, can be updated later
        })
        .then(() => {
          console.log('New user document created.');
          res.redirect('/set-name');
        })
        .catch(error => {
          console.error('Error creating new user document:', error);
          res.status(500).send('An error occurred while creating user profile');
        });
      } else {
        // Get the user document from the 'users' collection
        return db.collection('users').doc(userDocId).get()
          .then(userDoc => {
            if (userDoc.exists) {
              username = userDoc.data().name;

              // Query the user's 'personas' sub-collection to get chat references
              return db.collection('users')
                .doc(userDocId)
                .collection('personas')
                .get();
            } else {
              throw new Error('User document not found');
            }
          })
          .then(chatsSnapshot => {
            // Create an array of chat IDs
            const chatRefs = chatsSnapshot.docs.map(doc => doc.id);
            console.log("Chat references found:", chatRefs);

            // Fetch both chat metadata and the subChat data for each chat
            return Promise.all(chatRefs.map(chatId => {
              // Fetch the main chat metadata from the `chats` collection
              const fetchChatMetadata = db.collection('chats')
                .doc(chatId)
                .get()
                .then(chatDoc => {
                  if (chatDoc.exists) {
                    console.log("Main chat metadata for chatId:", chatId, chatDoc.data());
                    return chatDoc.data();
                  } else {
                    console.log("No chat document found for chatId:", chatId);
                    return null;
                  }
                });

              // Fetch subChat references from the user's `personas/{chatId}/subChats` collection
              const fetchSubChatRefsFromUser = db.collection('users')
                .doc(userDocId)
                .collection('personas')
                .doc(chatId)
                .collection('subChats')
                .get()
                .then(subChatRefsSnapshot => {
                  const subChatRefs = subChatRefsSnapshot.docs.map(refDoc => refDoc.id);
                  console.log("SubChat references found for chatId:", chatId, subChatRefs);
                  return subChatRefs;
                });

              // Combine both promises to get the main chat metadata and subChat references
              return Promise.all([fetchChatMetadata, fetchSubChatRefsFromUser])
                .then(([chatMetadata, subChatRefs]) => {
                  if (!chatMetadata) {
                    console.log("Skipping chatId as no chat metadata found.");
                    return null; // Skip if no main chat metadata exists
                  }

                  // Fetch the actual subChat metadata from the `chats/{chatId}/subChats` collection
                  return db.collection('chats')
                    .doc(chatId)
                    .collection('subChats')
                    .get()
                    .then(subChatsSnapshot => {
                      const subChatData = subChatsSnapshot.docs
                        .filter(subChatDoc => subChatRefs.includes(subChatDoc.id))
                        .map(subChatDoc => ({ id: subChatDoc.id, ...subChatDoc.data() }));

                      console.log("SubChat data for chatId:", chatId, subChatData);

                      return {
                        id: chatId,
                        ...chatMetadata,
                        subChats: subChatData
                      };
                    });
                });
            }));
          })
          .then(chatDataWithIds => {
            // Filter out any null chats (in case a chat document doesn't exist)
            chatDataWithIds = chatDataWithIds.filter(chat => chat !== null);
            console.log("Final chat data being passed to res.render:", chatDataWithIds);

            // Log and send the chat data along with the username to the frontend
            res.render('chats', { chatData: chatDataWithIds, username });
          })
          .catch(error => {
            console.error('Error fetching chat data:', error);
            res.status(500).send('An error occurred while fetching chat data');
          });
      }
    })
    .catch(error => {
      console.error('Error fetching user or Firestore document:', error);
      res.status(500).send('An error occurred');
    });
});






app.get('/create/chat/:id', authenticateChat, async (req, res) => {
  const authUserId = req.user.uid;  // Firebase Auth user ID
  const chatId = req.params.id;
  let phoneNumber;

  try {
    // Get the phone number from Firebase Auth
    const userRecord = await admin.auth().getUser(authUserId);
    phoneNumber = userRecord.phoneNumber;
    console.log("userphoen 777777777777777777", phoneNumber);
    console.log("User's phone number:", phoneNumber);

    // Query Firestore for the user document based on the phone number
    const userSnapshot = await db.collection('users').where('phone', '==', phoneNumber).limit(1).get();
    if (userSnapshot.empty) {
      return res.status(404).send('User not found');
    }

    const userDocId = userSnapshot.docs[0].id;  // Get the Firestore userDocId
    const userDocRef = db.collection('users').doc(userDocId);
    const personaDocRef = userDocRef.collection('personas').doc(chatId);

    // Check if the persona exists for the user
    const personaDoc = await personaDocRef.get();

    // If the persona doesn't exist, create it
    if (!personaDoc.exists) {
      console.log(`Persona for chatId ${chatId} does not exist. Creating...`);
      await personaDocRef.set({
        createdAt: new Date(),
      });
      console.log(`Persona for chatId ${chatId} created.`);
    }

    // Create a new subchat in both personas and chats collections
    const newSubChatId = db.collection('chats').doc().id; // Generate a unique ID for the subchat
    const newSubChat = {
      createdAt: new Date(),
      participants: [userDocId],  // Add the user as the first participant
    };

    // Add the new subchat to both collections (user's persona and main chats collection)
    const createSubChatInUser = personaDocRef.collection('subChats').doc(newSubChatId).set(newSubChat);
    const createSubChatInChats = db.collection('chats').doc(chatId).collection('subChats').doc(newSubChatId).set(newSubChat);

    // Wait for both subchat creations to complete
    await Promise.all([createSubChatInUser, createSubChatInChats]);

    console.log(`SubChat ${newSubChatId} created for chat ${chatId}`);

    // Send a response back to the client
    res.status(200).redirect(`/chat/${chatId}/${newSubChatId}`);
  } catch (error) {
    console.error('Error creating subchat:', error);
    res.status(500).send('Error creating subchat');
  }
});


















//handle anonymous chats
app.get('/chat/:id/:sub', authenticateChat, async (req, res) => {
  const chatId = req.params.id;
  const subId = req.params.sub;
  const authUserId = req.user.user_id;
  let subChatRef;
  let userSubChatRef;

  try {
    const userRecord = await admin.auth().getUser(authUserId);
    const phoneNumber = userRecord.phoneNumber;

    const userSnapshot = await db.collection('users').where('phone', '==', phoneNumber).limit(1).get();
    if (userSnapshot.empty) {
      return res.status(404).send('User not found');
    }

    const userDocId = userSnapshot.docs[0].id;
    subChatRef = db.collection('chats').doc(chatId).collection('subChats').doc(subId);
    
    // logic for handling when user isn't yet assigned to chat.

    const userChatRef = db.collection('users').doc(userDocId).collection('personas').doc(chatId);
    if (!userChatRef.exists){
      await userChatRef.set({});
    }
    
    userSubChatRef = db.collection('users').doc(userDocId).collection('personas').doc(chatId).collection('subChats').doc(subId);
    //participantName = db.collection('users').doc(userDocId).collection('personas').doc(chatId).collection('subChats').doc(subId);

    const subChatDoc = await subChatRef.get();
    
    if (!userSubChatRef.exists) {
      console.log("user didn't have subchat stored against them so creating it....");
      
      
      //db.collection('users').doc(userDocId).collection('personas').doc(chatId).collection('subChats').doc(subId).set({});
      await userSubChatRef.set({});

      let participants = subChatDoc.data().participants || [];
      
      let participantDocRef = await db.collection('users').doc(userDocId).get();
      let participantName = participantDocRef.exists ? participantDocRef.data().name : "Unknown";

      const userExistsInParticipants = participants.some(participant => participant.startsWith(userDocId));

      if (!userExistsInParticipants) {
        participants.push(`${userDocId} - ${participantName}`);  // Manually add the userDocId to the array
      }

      await subChatRef.update({ participants });

      
    }
      

    

    if (!subChatDoc.exists) {
      return res.status(404).send('SubChat not found');
    }

    const subChatData = subChatDoc.data();
    const messagesCollectionPath = subChatData.direct
      ? subChatRef.collection('private_messages').doc(userDocId).collection('messages')
      : subChatRef.collection('messages');

    // Ensure the collection path exists
    const messagesExistsSnapshot = await messagesCollectionPath.limit(1).get();
    if (messagesExistsSnapshot.empty && subChatData.direct) {
      await messagesCollectionPath.doc().set({ content: "Starting private chat..." });
    } else if (messagesExistsSnapshot.empty) {
      await messagesCollectionPath.doc().set({ content: "Starting group chat..." });
    }

    const messagesSnapshot = await messagesCollectionPath.orderBy('timestamp').get();
    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.render('chat', { chatData: subChatData, chatId, subId, messages, userDocId });
  } catch (error) {
    console.error('Error fetching chat data:', error);
    res.status(500).send('An error occurred while fetching chat data');
  }
});


//handle a user quitting a group.
app.get('/leavegroup/:id/:sub', authenticateChat, async (req, res) => {
  const chatId = req.params.id;
  const subId = req.params.sub;
  const authUserId = req.user.user_id;

  try {
    // Get the user's phone number from Firebase Auth
    const userRecord = await admin.auth().getUser(authUserId);
    const phoneNumber = userRecord.phoneNumber;

    // Fetch the Firestore document for the user based on their phone number
    const userSnapshot = await db.collection('users').where('phone', '==', phoneNumber).limit(1).get();
    if (userSnapshot.empty) {
      return res.status(404).send('User not found');
    }

    const userDocId = userSnapshot.docs[0].id;
    const userSubChatRef = db.collection('users').doc(userDocId).collection('personas').doc(chatId).collection('subChats').doc(subId);
    const userChatRef = db.collection('users').doc(userDocId).collection('personas').doc(chatId);

    // Check if the subChat document exists for the user and delete it if it does
    const userSubChatDoc = await userSubChatRef.get();
    const userChatRefDoc = await userChatRef.get();
    
    if (userSubChatDoc.exists) {
      await userSubChatRef.delete();
      console.log(`SubChat ${subId} removed from user's persona.`);
      
      // Check if there are any remaining subChats
      const remainingSubChats = await userChatRef.collection('subChats').get();
      if (remainingSubChats.empty) {
        await userChatRef.delete();
        console.log(`Chat ${chatId} removed from user's personas as it has no more subChats.`);
      }
    }

    // Redirect to /chat once the subChat is removed or if it doesn't exist
    res.redirect('/chat');
  } catch (error) {
    console.error("Error leaving group:", error);
    res.status(500).send('An error occurred while leaving the group');
  }
});









app.get('/user', async (req, res) => {
  const token = req.cookies['__session'];
  if (!token) {
    res.redirect('/getmein');
  }

  try {
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Get the authenticated user's phone number from Firebase Auth
    const userRecord = await admin.auth().getUser(uid);
    const phoneNumber = userRecord.phoneNumber;

    if (!phoneNumber) {
      return res.status(400).send('Phone number not available');
    }

    // Query Firestore to find the user document by matching the phone number
    const querySnapshot = await db.collection('users')
      .where('phone', '==', phoneNumber)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).send('User not found');
    }

    // Extract the user document
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    //const userName = userData.name || 'Anonymous';

    let userName = userData.name;

    if (!userName) {
      userName = '';
      res.render('set-name', { userName: userName });
    } else {
      res.redirect('/chat');
    }

    

    // Send the username back to the client
    //res.send(userName);
    //res.render('set-name', { userName: userName });

  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).send('An error occurred while fetching user data');
  }
});

app.post('/save-name', async (req, res) => {
  const { name, idToken } = req.body;

  if (!name || !idToken) {
    return res.status(400).send('Missing name or ID token');
  }

  try {
    // Verify the Firebase ID token to get user details
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get the user's phone number from Firebase Auth
    const userRecord = await admin.auth().getUser(uid);
    const phoneNumber = userRecord.phoneNumber;

    // Find the user document in Firestore by phone number
    const querySnapshot = await admin.firestore().collection('users')
      .where('phone', '==', phoneNumber)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).send('User not found');
    }

    // Update the user's name in Firestore
    const userDocRef = querySnapshot.docs[0].ref;
    await userDocRef.update({ name });

    res.status(200).send('Name updated successfully');
  } catch (error) {
    console.error('Error updating name:', error);
    res.status(500).send('An error occurred while updating the name');
  }
});





app.post('/ask-bob', async (req, res) => {
  const { message, chatId, subId, userId, sender, timestamp } = req.body;
  console.log("reqbody}}}}}}}}}}}}}}}}}}]", req.body);

  try {
    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();
    const subRef = chatRef.collection('subChats').doc(subId);
    const subDoc = await subRef.get();

    if (!chatDoc.exists || !subDoc.exists) {
      return res.status(404).send('Chat or SubChat not found');
    }

    const chatData = chatDoc.data();
    const subChatData = subDoc.data();
    const subChatContext = subChatData.subchat_context.join(' ');
    console.log("chat conexxxxxxxxxxxxt", subChatContext);
    

    // Fetch user's Firestore document ID based on `userId`
    //const userRecord = await admin.auth().getUser(userId);
    //const phoneNumber = userRecord.phoneNumber;
    //const userSnapshot = await db.collection('users').doc(userId).get();
    //if (userSnapshot.empty) {
    //  return res.status(404).send('User not found');
    //}
    const userDocId = userId;

    // Set up the appropriate collection path based on `direct`
    const messagesCollection = subChatData.direct
      ? subRef.collection('private_messages').doc(userDocId).collection('messages')
      : subRef.collection('messages');

    // Check if messages collection exists by attempting to get the first document
    const messageExistsSnapshot = await messagesCollection.limit(1).get();
    if (messageExistsSnapshot.empty && subChatData.direct) {
      // Create the `private_messages` path if it doesn't exist for a direct chat
      await messagesCollection.doc().set({ content: "Starting private chat..." });
    } else if (messageExistsSnapshot.empty) {
      // Create the `messages` path if it doesn't exist for a non-direct chat
      await messagesCollection.doc().set({ content: "Starting group chat..." });
    }

    // Proceed with adding the user's message
    await messagesCollection.add({
      content: message,
      timestamp: timestamp,
      sender: sender,
      userId: userDocId
    });

    // Fetch recent messages and call the external API
    const recentMessagesSnapshot = await messagesCollection
      .orderBy('timestamp', 'desc')
      .limit(15)
      .get();

    const recentMessages = recentMessagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).reverse();

    // API call preparation
    const requestBody = {
      inputs: {
        message,
        prompty: chatData.prompty,
        context: subChatContext,
        persona: chatData.persona,
        participants: JSON.stringify(subChatData.participants || []),
        todaysdate: new Date().toISOString(),
        recentMessages: JSON.stringify(recentMessages),
      },
      version: `^${chatData.version}`
    };

    console.log("request body for api call:", requestBody);

    const response = await axios.post(chatData.apiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${chatData.bearerToken}`,
        'Content-Type': 'application/json',
      }
    });

    const responseData = response.data;
    const chunks = responseData.split('\n').filter(chunk => chunk.trim() !== '');
    let finalResponse = '';
    

    for (const chunk of chunks) {
      try {
        const parsedChunk = JSON.parse(chunk);
        if (parsedChunk.type === 'chunk' && parsedChunk.value.type === 'outputs') {
          finalResponse = parsedChunk.value.values.new_structured_generation.response;
          break;
        }
      } catch (e) {
        console.error('Error parsing chunk:', e.message);
      }
    }

    if (finalResponse && !finalResponse.includes('__ignore')) {
      const newMessage = {
        content: finalResponse,
        sender: chatData.friendly_name,
        timestamp: Math.floor(new Date().getTime() / 1000),
        userId: 'bob-ai'
      };

      await messagesCollection.add(newMessage);
      res.json({ success: true, response: finalResponse });
    } else if (finalResponse && finalResponse.includes('__ignore')) {
      res.json({ success: true, response: 'Message ignored' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to extract response' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});







// Export as Firebase Function
exports.app = functions.https.onRequest((req, res) => {
  server.emit('request', req, res);
});

//app.listen(3000);