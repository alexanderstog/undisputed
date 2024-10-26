document.addEventListener('DOMContentLoaded', function() {
    const snowflake = document.getElementById('snowflake');
    if (snowflake) {
        snowflake.addEventListener('click', enterSnowflakeMode);
    }
});

function enterSnowflakeMode() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.overflow = 'hidden';
    document.body.appendChild(overlay);

    // Add massive text
    const text = document.createElement('div');
    text.textContent = 'ENTERING SNOWFLAKE MODE';
    text.style.fontSize = '2rem';
    text.style.fontWeight = 'bold';
    text.style.color = '#1f0767';
    text.style.textAlign = 'center';
    text.style.width = '60%';
    text.style.animation = 'pulse 0.5s infinite alternate';
    overlay.appendChild(text);

    // Create snowflakes
    for (let i = 0; i < 50; i++) {
        createSnowflake(overlay);
    }

    // Add spinning emoji
    const spinningEmoji = document.createElement('div');
    spinningEmoji.textContent = '';
    spinningEmoji.style.fontSize = '5rem';
    spinningEmoji.style.position = 'absolute';
    spinningEmoji.style.animation = 'spin 1s linear infinite';
    overlay.appendChild(spinningEmoji);

    // Redirect after animation
    setTimeout(() => {
        window.location.href = '/chat/nJ84vsuk9izOjq8dNj9N/6hU7a9JdJAn3BP45zrt6';
    }, 2000);
}

function createSnowflake(parent) {
    const snowflake = document.createElement('div');
    snowflake.textContent = '❄️';
    snowflake.style.position = 'absolute';
    snowflake.style.fontSize = `${Math.random() * 30 + 10}px`;
    snowflake.style.left = `${Math.random() * 100}vw`;
    snowflake.style.animationDuration = `${Math.random() * 2 + 1}s`;
    snowflake.style.opacity = Math.random();
    snowflake.style.animation = `fall ${Math.random() * 5 + 5}s linear infinite`;
    parent.appendChild(snowflake);
}

// Add styles to the document
const style = document.createElement('style');
style.textContent = `
    @keyframes fall {
        0% { transform: translateY(-100vh) rotate(0deg); }
        100% { transform: translateY(100vh) rotate(360deg); }
    }
    @keyframes pulse {
        0% { transform: scale(1); }
        100% { transform: scale(1.1); }
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
