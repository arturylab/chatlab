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
            <p class="mb-0">Hello! Ask me anything about programming.</p>
        </div>
    `;
}

// Render conversation history
function renderConversation() {
    const content = conversationHistory.map(msg => {
        let parsedContent = msg.content
            // [ ... ] → display math (block)
            .replace(/\[([^\[\]]+)\]/g, (match, p1) => `$${p1}$`)
            // ( ... ) with LaTeX → inline math if contains backslash
            .replace(/\(([^\(\)\\]*\\[^\(\)]*)\)/g, (match, p1) => `\\(${p1}\\)`)
            // ( ... ) separated by spaces → inline math
            .replace(/\(\s+([^()]+)\s+\)/g, (match, p1) => `\\(${p1.trim()}\\)`)
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
    // Render MathJax
    if (window.MathJax) MathJax.typesetPromise();
}

// Scroll response area to bottom
function scrollToBottom() {
    const contentDiv = responseArea.querySelector('.response-content');
    contentDiv.scrollTop = contentDiv.scrollHeight;
}

// Send prompt to backend
function sendPrompt() {
    const prompt = promptInput.value.trim();
    if (!prompt) return;
    conversationHistory.push({ role: 'user', content: prompt });
    renderConversation();
    promptInput.value = '';
    promptInput.focus();

    // Show "thinking..." message
    appendAssistantMessage('...');
    const data = {
        prompt: prompt,
        model: modelSelect.value,
        history: conversationHistory
    };

    // API call (streaming)
    fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(response => {
        if (!response.body) throw new Error('No response from server');
        const reader = response.body.getReader();
        let assistantMsg = '';
        function readChunk() {
            return reader.read().then(({ done, value }) => {
                if (done) {
                    updateLastAssistantMessage(assistantMsg);
                    return;
                }
                const chunk = new TextDecoder().decode(value);
                chunk.split('\n').forEach(line => {
                    if (line.startsWith('data:')) {
                        try {
                            const data = JSON.parse(line.replace('data:', '').trim());
                            if (data.token) {
                                assistantMsg += data.token;
                                updateLastAssistantMessage(assistantMsg);
                            }
                            if (data.error) {
                                updateLastAssistantMessage('❌ Error: ' + data.error);
                            }
                        } catch (e) {}
                    }
                });
                scrollToBottom();
                return readChunk();
            });
        }
        return readChunk();
    }).catch(err => {
        updateLastAssistantMessage('❌ Error: ' + err.message);
    });
}

// Add temporary assistant message
function appendAssistantMessage(content) {
    conversationHistory.push({ role: 'assistant', content: content });
    renderConversation();
}

// Update last assistant message (for streaming)
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