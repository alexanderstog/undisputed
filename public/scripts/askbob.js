document.getElementById('ask-bob-form').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the form from submitting and reloading the page

    // Now trigger the same functionality as when the "Ask Bob" button is clicked
    document.getElementById('ask-bob-button').click();
});

document.getElementById('ask-bob-button').addEventListener('click', async () => {
    console.log("asking bob");
    const message = document.getElementById('message').value;
    console.log("message is " + message);

    // Store the outgoing message in the chat
    const outgoingDiv = document.createElement('div');
    outgoingDiv.className = 'response message-right';
    outgoingDiv.innerText = message;

    // Clear the input
    document.getElementById('message').value = "";

    // Append the outgoing message to the chat
    const chatWrapper = document.querySelector('.chat-wrapper');
    if (chatWrapper) {
        chatWrapper.appendChild(outgoingDiv);
    }

    // Scroll to the bottom after appending the message
    scrollToBottom();

    // Show "Bob is thinking..." message
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'response thinking';
    thinkingDiv.innerText = "Bob is thinking...";

    // Append the "thinking" message to the chat
    if (chatWrapper) {
        chatWrapper.appendChild(thinkingDiv);
        scrollToBottom();
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so add 1
    const dd = String(today.getDate()).padStart(2, '0');

    const todaysdate = `${yyyy}-${mm}-${dd}`;
    console.log(todaysdate);

    // Function to get the value of a cookie by name
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    // Check for the 'username' cookie
    const username = getCookie('username');

    if (username) {
        console.log("Username is " + username);
    } else {
        window.location.href = '/set-name?something=yes';
        return; // Stop execution if redirecting
    }

    try {
        const response = await fetch('/ask-bob', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message, todaysdate, username }),
        });

        const result = await response.json();

        // Remove the "Bob is thinking..." message
        chatWrapper.removeChild(thinkingDiv);

        if (result.success) {
            const responseDiv = document.createElement('div');
            responseDiv.className = 'response';
            responseDiv.innerText = result.response;

            chatWrapper.appendChild(responseDiv);
            scrollToBottom();
        } else {
            document.getElementById('response').innerText = `API call failed: ${result.error}`;
        }
    } catch (error) {
        // Remove the "Bob is thinking..." message in case of an error
        chatWrapper.removeChild(thinkingDiv);

        document.getElementById('response').innerText = `Error: ${error.message}`;
    }
});

// Function to scroll to the bottom of the chat
function scrollToBottom() {
    const chatWrapper = document.querySelector('.chat-wrapper');
    chatWrapper.scrollTop = chatWrapper.scrollHeight;
}
