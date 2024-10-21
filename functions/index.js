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
    return res.render('getmein');
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
        console.log(">>>>>>>User document not found in Firestore");
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
    return res.render('getmein');
    
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
    maxAge: 3600000,     // 1 hour expiration
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
app.get('/user', authenticateRequest, (req, res) => {
  const uid = req.user.uid;
  console.log(">>>>>>>>>>>>>>> uid is:" + uid);

  let username;

  admin.auth().getUser(uid)
    .then(userRecord => {
      const phoneNumber = userRecord.phoneNumber; // Get the phone number from Auth
      console.log(">>>>>>>> the phone number we're looking for is " + phoneNumber);

      // Query Firestore for a document where the 'phone' field matches phoneNumber
      return db.collection('users')
        .where('phone', '==', phoneNumber)
        .limit(1)
        .get();
    })
    .then(querySnapshot => {
      if (!querySnapshot.empty) {
        // Extract the document ID from the first (and presumably only) matching document
        const userDocId = querySnapshot.docs[0].id;
        console.log('Document ID:', userDocId);
        return userDocId; // Return the userDocId to the next .then()
      } else {
        console.log('No matching documents found');
        return null; // Return null if no document is found
      }
    })
    .then(userDocId => {
      console.log(">>>>>>>>>  userid is " + userDocId);

      if (!userDocId) {
        res.send('need to do something with users that do not exist');
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
            const chatRefs = chatsSnapshot.docs.map(doc => {
              if (doc.exists) {
                return { 
                  id: doc.id, // Chat ID
                };
              } else {
                console.log(`Chat document ${doc.id} does not exist`);
                return null;
              }
            }).filter(data => data !== null); // Filter out null values

            // Fetch both chat metadata and the subChat data for each chat
            return Promise.all(chatRefs.map(chatRef => {
              // Fetch the main chat metadata from the `chats` collection
              const fetchChatMetadata = db.collection('chats')
                .doc(chatRef.id)
                .get()
                .then(chatDoc => {
                  if (chatDoc.exists) {
                    return chatDoc.data();
                  } else {
                    return null;
                  }
                });

              // Fetch subChat references from the user's `personas/{chatId}/subChats` collection
              const fetchSubChatRefsFromUser = db.collection('users')
                .doc(userDocId)
                .collection('personas')
                .doc(chatRef.id)
                .collection('subChats')
                .get()
                .then(subChatRefsSnapshot => {
                  return subChatRefsSnapshot.docs.map(refDoc => refDoc.id); // Collect only the subChat IDs (references)
                });

              // Combine both promises to get the main chat metadata and subChat references from the user
              return Promise.all([fetchChatMetadata, fetchSubChatRefsFromUser])
                .then(([chatMetadata, subChatRefs]) => {
                  if (!chatMetadata) {
                    return null; // Skip if no main chat metadata exists
                  }

                  // Fetch the actual subChat metadata from the `chats/{chatId}/subChats` collection using the references
                  return db.collection('chats')
                    .doc(chatRef.id)
                    .collection('subChats')
                    .get()
                    .then(subChatsSnapshot => {
                      // Filter to include only subChats that match the references from the user collection
                      let subChatData = subChatsSnapshot.docs
                        .filter(subChatDoc => subChatRefs.includes(subChatDoc.id)) // Only include the referenced subChats
                        .map(subChatDoc => ({ id: subChatDoc.id, ...subChatDoc.data() }));

                      // If no subChats exist in the user collection or chat collection, create a default one
                      if (subChatData.length === 0) {
                        const newSubChatId = db.collection('chats').doc().id; // Generate a unique ID for the new subChat
                        const newSubChat = {
                          group_name: 'Default SubChat',
                          created_at: new Date(),
                          // Add any other default fields for a new subChat here
                        };

                        // Create subChat in both the user's personas collection and the main chats collection
                        const createInUserCollection = db.collection('users')
                          .doc(userDocId)
                          .collection('personas')
                          .doc(chatRef.id)
                          .collection('subChats')
                          .doc(newSubChatId)
                          .set(newSubChat);

                        const createInChatsCollection = db.collection('chats')
                          .doc(chatRef.id)
                          .collection('subChats')
                          .doc(newSubChatId)
                          .set(newSubChat);

                        // Wait for both creations and push into the subChatData array
                        return Promise.all([createInUserCollection, createInChatsCollection])
                          .then(() => {
                            subChatData.push({ id: newSubChatId, ...newSubChat });
                            return subChatData;
                          });
                      } else {
                        return subChatData;
                      }
                    })
                    .then(subChatData => {
                      // Return the full chat data with the merged subChats
                      return {
                        id: chatRef.id,
                        ...chatMetadata,  // Include the main chat metadata
                        subChats: subChatData // Include actual subChat metadata
                      };
                    });
                });
            }));
          })
          .then(chatDataWithIds => {
            // Filter out any null chats (in case a chat document doesn't exist)
            chatDataWithIds = chatDataWithIds.filter(chat => chat !== null);

            // Log and send the chat data along with the username to the frontend
            console.log("PPPPP", chatDataWithIds);
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













//handle anonymous chats
app.get('/chat/:id/:sub', authenticateChat, async (req, res) => {
  console.log("req.user in /chat/:id route:", req.user.user_id);
  const chatId = req.params.id;
  const subId = req.params.sub;
  const userId = req.user.user_id;  // Assuming req.userId is available after authentication
  console.log(">>>>>>>userId is", userId);

  try {
    // Fetch the subChat document from the `subChats` collection of the given chatId
    const chatDoc = await db.collection('chats')
      .doc(chatId)
      .collection('subChats')
      .doc(subId)
      .get();

    if (!chatDoc.exists) {
      res.status(404).send('SubChat not found');
      return;
    }

    const chatData = chatDoc.data();
    
    // Fetch messages from the `messages` sub-collection within the `subChat`
    const messagesSnapshot = await db.collection('chats')
      .doc(chatId)
      .collection('subChats')
      .doc(subId)
      .collection('messages')
      .orderBy('timestamp')
      .get();

    // Create an array of messages
    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log("Messages:", messages);

    // Render the chat view with the subChat data and messages
    res.render('chat', { chatData, chatId, subId, messages });
  } catch (error) {
    console.error('Error fetching chat data:', error);
    res.status(500).send('An error occurred while fetching chat data');
  }
});




//route for a specific chat
/*
app.get('/chat/:id', authenticateChat, async (req, res) => {
  const chatId = req.params.id;
  const userId = req.userId;
  console.log(">>>>>>>>>>>>user id is", userId);
  try {
    const chatDoc = await db.collection('chats').doc(chatId).get();
    //wanna try and get old messages here.
    if (!chatDoc.exists) {
      res.status(404).send('Chat not found');
    } else {
      // Fetch messages collection within the chat
      const messagesSnapshot = await db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp').get();

    // Create an array of messages
      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log(">>>>>>>>>>>messages is", messages);

      const chatData = chatDoc.data();
      res.render('chat', { chatData, chatId, messages });
    }
  } catch (error) {
    console.error('Error fetching chat data:', error);
    res.status(500).send('An error occurred while fetching chat data');
  }
});

app.get('/info', (req, res) => {
  res.send('info about the current service');
});

app.get('/find', (req, res) => {
  res.send('input and gubbins to navigate to your own chat');
});

app.get('/set-name', (req, res) => {
  res.render('set-name');
});
*/



app.post('/ask-bob', async (req, res) => {
  const { message, chatId, subId, userId, sender } = req.body;  // Add subId to the request body

  try {
    
    const chatRef = db.collection('chats').doc(chatId);  // Update path to subChat
    const chatDoc = await chatRef.get();

    const subRef = db.collection('chats').doc(chatId).collection('subChats').doc(subId);  // Update path to subChat
    const subDoc = await subRef.get();

    if (!chatDoc.exists) {
      res.status(404).send('SubChat not found');
      return;
    }

    const chatData = chatDoc.data();
    let messagesCollection = subRef.collection('messages');  // Always use the subChat messages collection
    let recentMessages = [];

    // Add the user's message to the subChat's `messages` collection
    await messagesCollection.add({
      content: message,
      timestamp: new Date(),
      sender: sender,
      userId: userId
    });

    console.log(`Message added to chat ${chatId} subChat ${subId}`);

    // Fetch the 15 most recent messages from the `subChats/{subId}/messages` collection
    const recentMessagesSnapshot = await messagesCollection
      .orderBy('timestamp', 'desc')  // Order by timestamp descending
      .limit(15)  // Limit to 15 most recent messages
      .get();

    // Format the 15 most recent messages as an array
    recentMessages = recentMessagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).reverse();  // Reverse to make them ascending (oldest to newest)

    const recentMessagesString = JSON.stringify(recentMessages);

    // Fetch chat version, bearer token, and apiUrl for Bob's response
    let chatVersion = "^" + chatData.version;
    let bearerToken = chatData.bearerToken;
    let prompty = chatData.prompty; //prompt from chat document
    let persona = chatData.persona; //persona identifier from chat document
    let participants = chatData.participants; //participants from chat document
    let chatFriendlyName = chatData.friendly_name;
    let apiUrl = chatData.apiUrl;
    const todaysdate = new Date().toISOString();

    const requestBody = {
      inputs: {
        message: message,
        prompty: prompty,
        persona: persona,
        participants: participants,
        todaysdate: todaysdate,
        recentMessages: recentMessagesString  // Include recent messages in the request body
      },
      version: chatVersion
    };

    // Make API call to Bob for the response
    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
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

    if (finalResponse) {
      console.log("final response was found");

      const newMessage = {
        content: finalResponse,
        sender: chatFriendlyName,  // Using chat's friendly name as the sender
        timestamp: new Date(),
        userId: 'bob-ai'  // Bob's userId
      };

      // Add Bob's response to the subChat's `messages` collection
      await messagesCollection.add(newMessage);

      console.log("Bob's response added to the chat");
      res.json({ success: true, response: finalResponse });
    } else {
      res.status(500).json({ success: false, error: 'Failed to extract response' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



//message interaction logic
/* 
app.post('/ask-bob', async (req, res) => {
  console.log(">>>>> bob has been asked");
  const { message, chatId, userId, sender } = req.body;
  
  try {
    // Get a reference to the chat document
    const chatRef = db.collection('chats').doc(chatId);
  
    
    console.log(`User is sending a message to chat ${chatId}`);
    // Add the message to the 'messages' subcollection
    await chatRef.collection('messages').add({
      content: message,
      timestamp: new Date(),
      sender: sender,
      userId: userId 
    });

    console.log(`Message added to chat ${chatId}`);
  } catch (error) {
    console.error('Error adding message to chat:', error);
    return res.status(500).json({ success: false, error: 'Failed to save message' });
  }


  console.log(">>>>>>>>>>> chatId is" + chatId);
  console.log(">>>>>>>>>>>" + chatId + "<<<<<<<<");
  
  // Initialize chatVersion, bearerToken, and apiUrl with default values
  let chatVersion = ''; 
  let bearerToken = ''; 
  let apiUrl = ''; 

  try {
    console.log(">>>>>> get the chat document");
    const chatDoc = await db.collection('chats').doc(chatId).get();
    
    if (chatDoc.exists) {
      console.log(">>>>>>> the chat document exists");
      const chatData = chatDoc.data();
      console.log("chatData >>>>>>>>", chatData);
      // Assign the values from chatDoc
      chatVersion = "^" + chatData.version;
      bearerToken = chatData.bearerToken;
      apiUrl = chatData.apiUrl;
      

    } else {
      console.log('XXXXXXXXXX Chat document not found');
    }
  } catch (error) {
    console.error('XXXXXXXXXXXX Error fetching chat document:', error);
  }
  const todaysdate = new Date().toISOString();

  const requestBody = {
      inputs: {
          message: message,
          todaysdate: todaysdate
      },
      version: chatVersion
  };

  try {
    //console.log(">>>>> apirequest information");
    //console.log("xxxxxxxxxxx apiurl information" + apiUrl);
    //console.log(bearerToken);
    //console.log(requestBody);
    
    console.log(">>>> apiUrl:", apiUrl);
    console.log(">>>> bearerToken:", bearerToken);
    console.log(">>>> requestBody:", requestBody);

    console.log("MMMMMMMMMMMMMMM About to make axios POST request");
    const response = await axios.post(apiUrl, requestBody, {
        headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
        }
    });
    console.log("Axios POST request completed successfully");

    const responseData = response.data;
    console.log(">>>>>response data", responseData);

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
        console.log("final response was found");
        // Add the final response to the messages of this chat
        const newMessage = {
            content: finalResponse,
            sender: 'Bob',
            timestamp: new Date(),
            userId: 'bob-ai'  // You might want to use a specific ID for Bob
        };

        // Add the new message to the Firestore collection
        await admin.firestore().collection(`chats/${chatId}/messages`).add(newMessage);

        console.log("Bob's response added to the chat");
        // res.json({ success: true, response: finalResponse });
    } else {
      console.log("error here as234234234234kdjaskldj");  
      res.status(500).json({ success: false, error: 'Failed to extract response' });
    }
  } catch (error) {
    console.log("error here askdjaskldj");
      res.status(500).json({ success: false, error: error.message });
  }
});
*/











// Export as Firebase Function
exports.app = functions.https.onRequest((req, res) => {
  server.emit('request', req, res);
});

//app.listen(3000);