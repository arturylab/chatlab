let conversationHistory = [];
const responseArea = document.getElementById('response');
const promptInput = document.getElementById('prompt');
const sendButton = document.getElementById('sendButton');

// Model selection handling
let selectedModelValue = 'gemma3:1b';
const modelDropdown = document.getElementById('modelDropdown');
const selectedModelSpan = document.getElementById('selectedModel');

// Handle dropdown selection
document.addEventListener('DOMContentLoaded', () => {
    const dropdownItems = document.querySelectorAll('.dropdown-item[data-value]');
    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            selectedModelValue = e.target.getAttribute('data-value');
            selectedModelSpan.innerHTML = e.target.innerHTML;
        });
    });
});

// Create a compatibility object for modelSelect
const modelSelect = {
    get value() {
        return selectedModelValue;
    }
};

// Send prompt on Enter (Shift+Enter for new line)
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
    }
});

// Send prompt on button click
sendButton.addEventListener('click', sendPrompt);

// Clear conversation
window.clearConversation = () => {
    conversationHistory = [];
    renderWelcome();
};

// Render welcome message
function renderWelcome() {
    responseArea.querySelector('.response-content').innerHTML = `
        <div class="text-muted text-center py-5 h-100 d-flex flex-column justify-content-center">
            <i class="bi bi-chat-square-dots fs-1 mb-3"></i>
            <p class="mb-0">Hello! Ask me anything about math, physics, chemistry & programming.</p>
        </div>
    `;
}

// Render conversation history
function renderConversation() {
    const content = conversationHistory.map(msg => {
        let parsedContent = msg.content
            // // [ ... ] → display math (block)
            // .replace(/\[([^\[\]]+)\]/g, (match, p1) => `$${p1}$`)
            // // ( ... ) with LaTeX → inline math if contains backslash
            // .replace(/\(([^\(\)\\]*\\[^\(\)]*)\)/g, (match, p1) => `\\(${p1}\\)`)
            // // ( ... ) separated by spaces → inline math
            // .replace(/\(\s+([^()]+)\s+\)/g, (match, p1) => `\\(${p1.trim()}\\)`)
            // $...$ → inline math, but ignore $...$
            .replace(/(^|[^$])\$([^\$]+)\$(?!\$)/g, (match, pre, math) => `${pre}\\(${math}\\)`);
        if (msg.role === 'user') {
            return `
                <div class="mb-3">
                    <div class="fw-bold text-primary mb-1"><i class="bi bi-person-circle me-1"></i> You:</div>
                    <div class="markdown-content">${marked.parse(parsedContent)}</div>
                </div>
            `;
        } else if (msg.role === 'assistant') {
            return `
                <div class="mb-3">
                    <div class="fw-bold text-success mb-1"><i class="bi bi-robot me-1"></i> Assistant:</div>
                    <div class="markdown-content">${marked.parse(parsedContent)}</div>
                </div>
            `;
        }
        return '';
    }).join('');
    responseArea.querySelector('.response-content').innerHTML = content;
    responseArea.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
    });
    scrollToBottom();
    // Render MathJax only when necessary
    if (window.MathJax && content.includes('\\(')) {
        MathJax.typesetPromise();
    }
}

// Variable for scroll throttling
let scrollTimeout;
function scrollToBottom() {
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
        const contentDiv = responseArea.querySelector('.response-content');
        contentDiv.scrollTop = contentDiv.scrollHeight;
        scrollTimeout = null;
    }, 50);
}

// Send prompt to backend
function sendPrompt() {
    const prompt = promptInput.value.trim();
    if (!prompt) return;
    
    // Disable send button to avoid multiple requests
    sendButton.disabled = true;
    sendButton.innerHTML = '<i class="bi bi-hourglass-split"></i> <span class="ms-1">Sending...</span>';
    
    conversationHistory.push({ role: 'user', content: prompt });
    renderConversation();
    promptInput.value = '';

    // Show "thinking..." message
    appendAssistantMessage('Thinking...');
    const data = {
        prompt: prompt,
        model: modelSelect.value,
        history: conversationHistory
    };

    // API call (streaming) with better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal
    }).then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (!response.body) {
            throw new Error('No response body from server');
        }
        
        const reader = response.body.getReader();
        let assistantMsg = '';
        let updateCounter = 0;
        
        function readChunk() {
            return reader.read().then(({ done, value }) => {
                if (done) {
                    updateLastAssistantMessage(assistantMsg);
                    // Re-enable button
                    sendButton.disabled = false;
                    sendButton.innerHTML = '<i class="bi bi-send"></i> <span class="ms-1">Send</span>';
                    promptInput.focus();
                    return;
                }
                
                const chunk = new TextDecoder().decode(value);
                chunk.split('\n').forEach(line => {
                    if (line.startsWith('data:')) {
                        try {
                            const data = JSON.parse(line.replace('data:', '').trim());
                            if (data.token) {
                                assistantMsg += data.token;
                                // Update UI only every 5 chunks to reduce overhead
                                updateCounter++;
                                if (updateCounter % 3 === 0) {
                                    updateLastAssistantMessage(assistantMsg);
                                }
                            }
                            if (data.error) {
                                updateLastAssistantMessage('❌ Error: ' + data.error);
                                sendButton.disabled = false;
                                sendButton.innerHTML = '<i class="bi bi-send"></i> <span class="ms-1">Send</span>';
                                return;
                            }
                            if (data.done) {
                                updateLastAssistantMessage(assistantMsg);
                                sendButton.disabled = false;
                                sendButton.innerHTML = '<i class="bi bi-send"></i> <span class="ms-1">Send</span>';
                                return;
                            }
                        } catch (e) {
                            console.warn('Error parsing streaming data:', e);
                        }
                    }
                });
                
                return readChunk();
            });
        }
        return readChunk();
    }).catch(err => {
        clearTimeout(timeoutId);
        console.error('Fetch error:', err);
        let errorMessage = 'Connection error';
        if (err.name === 'AbortError') {
            errorMessage = 'Request timeout (2 minutes)';
        } else if (err.message.includes('HTTP error')) {
            errorMessage = err.message;
        }
        updateLastAssistantMessage('❌ Error: ' + errorMessage);
        sendButton.disabled = false;
        sendButton.innerHTML = '<i class="bi bi-send"></i> <span class="ms-1">Send</span>';
    });
}

// Add temporary assistant message
function appendAssistantMessage(content) {
    conversationHistory.push({ role: 'assistant', content: content });
    renderConversation();
}

// Update last assistant message (for streaming) - optimized
function updateLastAssistantMessage(content) {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
        if (conversationHistory[i].role === 'assistant') {
            conversationHistory[i].content = content;
            break;
        }
    }
    renderConversation();
}

// Initialize
renderWelcome();

if (window.MathJax) {
  MathJax.typesetPromise();
}