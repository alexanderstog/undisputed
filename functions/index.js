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
io.on('connection', (socket) => {
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


app.get('/', (req, res) => {
  res.redirect('/user');
});

app.get('/logout', (req, res) => {
  res.render('logout');
});


function authenticateRequest(req, res, next) {
  
  const token = req.cookies['idToken'];
  if (!token) {
    return res.render('getmein');
    
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
      res.clearCookie('idToken');  // Clear the token as it might be invalid/expired
      res.redirect('/');  // Redirect to login page
    });
}

function authenticateChat(req, res, next) {
  
  const token = req.cookies['idToken'];
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
  //let eventIds; // Declare eventIds at a higher scope

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
            res.send('User document does not exist');
        } else {
            // Now you can proceed with additional logic using userDocId
            
            // Get the user document from the 'users' collection
            db.collection('users').doc(userDocId).get()
                .then(userDoc => {
                    if (userDoc.exists) {
                        username = userDoc.data().name;
                        const chats = userDoc.data().chats || [];
                        
                        // Get all chat documents referenced in the user's chats array
                        return Promise.all(chats.map(chatId => 
                            db.collection('chats').doc(chatId).get()
                        ));
                    } else {
                        throw new Error('User document not found');
                    }
                })
                .then(chatDocs => {
                    // Extract data from each chat document
                    const chatData = chatDocs.map(doc => {
                        if (doc.exists) {
                            return doc.data();
                        } else {
                            console.log(`Chat document ${doc.id} does not exist`);
                            return null;
                        }
                    }).filter(data => data !== null);

                    // Send all chat data in the response
                    console.log(chatData);
                    const chatDataWithIds = chatDocs.map(doc => {
                        if (doc.exists) {
                            return { id: doc.id, ...doc.data() };
                        } else {
                            console.log(`Chat document ${doc.id} does not exist`);
                            return null;
                        }
                    }).filter(data => data !== null);
                    console.log(chatDataWithIds);
                    res.render('chats', { chatData: chatDataWithIds, username });
                })
                .catch(error => {
                    console.error('Error fetching chat data:', error);
                    res.status(500).send('An error occurred while fetching chat data');
                });
            // now take the doc ID and get all the chats. 
            // get all the chat friendly names and anonymous statuses. 
            // Example: Fetch events based on this document
        }
    })
    .catch(error => {
        console.error('Error fetching user or Firestore document:', error);
        res.status(500).send('An error occurred');
    });
    
});




//handle anonymous chats
app.get('/chat/:id', authenticateChat, async (req, res) => {
  console.log("req.user in /chat/:id route:", req.user.user_id);
  const chatId = req.params.id;
  const userId = req.user.user_id;  // Assuming req.userId is available after authentication
  console.log(">>>>>>>userId is", userId);


  try {
    const chatDoc = await db.collection('chats').doc(chatId).get();

    if (!chatDoc.exists) {
      res.status(404).send('Chat not found');
      return;
    }

    const chatData = chatDoc.data();

    // Check if the chat is anonymous
    if (chatData.anonymous) {
      console.log("MMMMMMMMMMMMMMMMM chat is anonymous");
      console.log(">>>>>>>>>>>", chatId, userId);
      const userPrivateMessagesDocRef = db.collection('chats')
        .doc(chatId)
        .collection('private-messages')
        .doc(userId);

      const userPrivateMessagesDoc = await userPrivateMessagesDocRef.get();

      // Check if the document for the user exists in private-messages
      if (!userPrivateMessagesDoc.exists) {
        console.log(`Private message document for user ${userId} does not exist. Creating one...`);
        
        // Create the document with some default structure, or leave it empty if you prefer
        await userPrivateMessagesDocRef.set({
          createdAt: new Date(),  // Example of some default data
          messages: []            // Initialize with an empty messages array or any other default fields
        });
        
        console.log(`Private message document for user ${userId} created.`);
      }

      // Now fetch messages from the newly created or existing `messages` collection
      const privateMessagesSnapshot = await userPrivateMessagesDocRef
        .collection('messages')
        .orderBy('timestamp')
        .get();

      // Create an array of private messages
      const privateMessages = privateMessagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log("Private messages:", privateMessages);

      res.render('chat', { chatData, chatId, messages: privateMessages });
    } else {
      // If not anonymous, fetch from the public `messages` collection as before
      const messagesSnapshot = await db.collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp')
        .get();

      // Create an array of public messages
      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log("Public messages:", messages);

      res.render('chat', { chatData, chatId, messages });
    }
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
  const { message, chatId, userId, sender } = req.body;

  try {
    const chatRef = db.collection('chats').doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      res.status(404).send('Chat not found');
      return;
    }

    const chatData = chatDoc.data();
    let messagesCollection;
    let recentMessages = [];

    // Check if chat is anonymous, decide which collection to use
    if (chatData.anonymous) {
      console.log("Chat is anonymous, using private-messages collection");
      messagesCollection = db.collection('chats')
        .doc(chatId)
        .collection('private-messages')
        .doc(userId)
        .collection('messages');
    } else {
      console.log("Chat is not anonymous, using public messages collection");
      messagesCollection = chatRef.collection('messages');
    }

    // Add the user's message to the appropriate collection
    await messagesCollection.add({
      content: message,
      timestamp: new Date(),
      sender: sender,
      userId: userId
    });

    console.log(`Message added to chat ${chatId}`);

    // Fetch the 10 most recent messages
    const recentMessagesSnapshot = await messagesCollection
      .orderBy('timestamp', 'desc')  // Order by timestamp descending
      .limit(15)  // Limit to 10 most recent messages
      .get();

    console.log(recentMessages);
    // Format the 10 most recent messages as an array
    recentMessages = recentMessagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).reverse();  // Reverse to make them ascending (oldest to newest)

    const recentMessagesString = JSON.stringify(recentMessages);

    // Fetch chat version, bearer token, and apiUrl for Bob's response
    let chatVersion = "^" + chatData.version;
    let bearerToken = chatData.bearerToken;
    let chatFriendlyName = chatData.friendly_name;
    let apiUrl = chatData.apiUrl;
    const todaysdate = new Date().toISOString();

    const requestBody = {
      inputs: {
        message: message,
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

      // Add Bob's response to the appropriate collection
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