// --- Cici AI Chatbot powered by Mistral AI ---
// This script handles all client-side logic for the chat application.
// It uses the Mistral AI API for chat completions and audio transcription.
// Video generation is not a feature of this application.

const CHAT_HISTORY_KEY = 'cici-chat-history';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = 'https://api.mistral.ai/v1';

// --- ICONS ---
const ICONS = {
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clip-rule="evenodd" /></svg>`,
  send: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>`,
  stop: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" /></svg>`,
  loadingSpinner: `<svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`,
  xCircle: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
  clipboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3A1.5 1.5 0 0 1 13 3.5v1A1.5 1.5 0 0 1 11.5 6h-3A1.5 1.5 0 0 1 7 4.5v-1Z" /><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 15.5v-9Z" /></svg>`,
  microphone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75v.75a4.5 4.5 0 0 0 9 0v-.75a.75.75 0 0 1 1.5 0v.75a6 6 0 1 1-12 0v-.75a.75.75 0 0 1 .75-.75Z" /></svg>`,
  thumbUp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 1 1-2.5 0v-7.5ZM11 3.25a1.75 1.75 0 0 1 1.75 1.75v3.258a1.75 1.75 0 0 0 .822 1.45l.978.558c.43.247.818.572 1.15.962V12a1.75 1.75 0 0 1-1.75 1.75h-3.418a1.75 1.75 0 0 1-1.683-1.325L8.5 8.25V5a1.75 1.75 0 0 1 1.75-1.75h.75Z" /></svg>`,
  thumbDown: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M1 11.75a1.25 1.25 0 1 0 2.5 0v-7.5a1.25 1.25 0 1 0-2.5 0v7.5ZM11 16.75a1.75 1.75 0 0 0 1.75-1.75v-3.258a1.75 1.75 0 0 1 .822-1.45l.978-.558c.43-.247.818-.572 1.15-.962V8a1.75 1.75 0 0 0-1.75-1.75h-3.418a1.75 1.75 0 0 0-1.683 1.325L8.5 11.75V15a1.75 1.75 0 0 0 1.75 1.75h.75Z" /></svg>`,
};

// --- DOM ELEMENTS ---
const dom = {
    appContent: document.getElementById('app-content'),
    chatScreen: document.getElementById('chat-screen'),
    chatHeader: document.querySelector('.chat-header'),
    newChatButton: document.getElementById('new-chat-button'),
    chatMessages: document.getElementById('chat-messages'),
    chatFooter: document.querySelector('.chat-footer'),
    attachmentPreview: document.getElementById('attachment-preview'),
    chatForm: document.getElementById('chat-form'),
    attachButton: document.getElementById('attach-button'),
    fileInput: document.getElementById('file-input'),
    messageInput: document.getElementById('message-input'),
    sendButton: document.getElementById('send-button'),
    recordButton: document.getElementById('record-button'),
};

// --- STATE ---
const initialMessages = [
    { id: 1, sender: 'bot', text: 'Olá! Como posso te ajudar hoje? 😊' },
    { 
        id: 2, 
        sender: 'bot', 
        text: 'Sinta-se à vontade para me perguntar qualquer coisa! Você também pode tentar uma dessas ações:',
        actions: [
            { id: 'track_goal', text: 'Track Goal', clicked: false },
            { id: 'set_reminder', text: 'Set Reminder', clicked: false }
        ]
    }
];

let state = {
  appState: 'chat',
  messages: [],
  conversationStep: 'done',
  inputValue: '',
  isTyping: false,
  attachedFile: null,
  isRecording: false,
  isTranscribing: false,
};

// --- MISTRAL API & HELPERS ---
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

// Transcribes audio using the Mistral AI Whisper model.
async function transcribeAudioWithMistral(audioFile) {
    const audioBlob = base64ToBlob(audioFile.data, audioFile.mimeType);
    
    const formData = new FormData();
    formData.append('file', audioBlob, audioFile.name);
    formData.append('model', 'mistral-whisper');

    const response = await fetch(`${MISTRAL_API_URL}/audio/transcriptions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Mistral transcription error:', errorData);
        throw new Error('Falha ao transcrever o áudio.');
    }

    const data = await response.json();
    return data.text;
}

// Fetches a chat completion from the Mistral AI API.
async function getMistralChatCompletion(prompt, imageFile, history) {
    const systemInstruction = "Você é a Cici, uma assistente de IA especialista em programação. Seu tom é amigável e encorajador. Ao fornecer código, sempre use blocos de código markdown (```) e especifique a linguagem (por exemplo, ```javascript) para formatação. Explique o código de forma clara e concisa.";

    const messages = [
        { role: 'system', content: systemInstruction }
    ];

    history.forEach(msg => {
        if (msg.sender === 'user') {
            const contentParts = [];
            if (msg.text) {
                contentParts.push({ type: 'text', text: msg.text });
            }
            if (msg.imageUrl) {
                 contentParts.push({ type: 'image_url', image_url: { url: msg.imageUrl } });
            }
            if (contentParts.length > 0) {
                 messages.push({ role: 'user', content: contentParts });
            }
        } else if (msg.sender === 'bot' && typeof msg.text === 'string') {
            if (!msg.text.includes('<div class="error-message">')) {
                messages.push({ role: 'assistant', content: msg.text });
            }
        }
    });

    const currentUserContent = [];
    if (prompt) {
        currentUserContent.push({ type: 'text', text: prompt });
    }
    if (imageFile) {
        currentUserContent.push({ type: 'image_url', image_url: { url: `data:${imageFile.mimeType};base64,${imageFile.data}` } });
    }
    messages.push({ role: 'user', content: currentUserContent });
    
    const response = await fetch(`${MISTRAL_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: messages,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Mistral chat error:', errorData);
        throw new Error('Falha ao se comunicar com a IA.');
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// --- AUDIO RECORDING ---
let mediaRecorder = null;
let audioChunks = [];

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };
        mediaRecorder.onstop = handleRecordingStop;
        mediaRecorder.start();
        setState({ isRecording: true });
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Não foi possível acessar o microfone. Verifique as permissões do seu navegador.");
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        setState({ isRecording: false });
    }
}

async function transcribeAndFillInput(audioFile) {
    setState({ isTranscribing: true });
    try {
        const transcription = await transcribeAudioWithMistral(audioFile);
        setState({ inputValue: transcription });
        if (dom.messageInput) {
            dom.messageInput.value = transcription;
            dom.messageInput.focus();
            dom.messageInput.dispatchEvent(new Event('input', { bubbles: true })); // Trigger UI update
        }
    } catch (error) {
        console.error("Transcription failed", error);
        alert(error.message || "Não foi possível transcrever o áudio.");
    } finally {
        setState({ isTranscribing: false });
    }
}

function handleRecordingStop() {
    if (audioChunks.length === 0) return;
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
        const base64Audio = reader.result.split(',')[1];
        const audioFile = {
            data: base64Audio,
            mimeType: 'audio/webm',
            name: `audio-message-${Date.now()}.webm`
        };
        transcribeAndFillInput(audioFile);
    };
}

// --- TEMPLATES / RENDER FUNCTIONS ---
function sanitize(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

function renderFormattedText(text) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map(part => {
        if (part.startsWith('```') && part.endsWith('```')) {
            const code = part.slice(3, -3).trim();
            const langMatch = code.match(/^[a-z]+\n/);
            const lang = langMatch ? langMatch[0].trim() : 'code';
            const codeContent = langMatch ? code.substring(lang.length + 1) : code;
            
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span>${sanitize(lang)}</span>
                        <button class="copy-button" data-code="${sanitize(codeContent)}">
                            <span class="copy-icon">${ICONS.clipboard}</span>
                            <span class="copy-text">Copiar</span>
                        </button>
                    </div>
                    <pre><code>${sanitize(codeContent)}</code></pre>
                </div>`;
        }
        let html = sanitize(part);
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }).join('');
}

function renderMessages() {
    if (!dom.chatMessages) return;
    const container = dom.chatMessages;

    container.innerHTML = '';

    state.messages.forEach(msg => {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${msg.sender}`;
        
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${msg.sender}`;

        let bubbleContent = '';
        if (msg.imageUrl) {
            bubbleContent += `<img src="${msg.imageUrl}" alt="Chat content">`;
        }
        if (msg.audioUrl) {
            bubbleContent += `<audio controls src="${msg.audioUrl}"></audio>`;
        }
        if (msg.text) {
            bubbleContent += typeof msg.text === 'string' ? renderFormattedText(msg.text) : msg.text;
        }
        bubble.innerHTML = bubbleContent;
        
        if (msg.actions && msg.actions.length > 0) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'message-actions';
            msg.actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'action-button';
                button.dataset.messageId = msg.id;
                button.dataset.actionId = action.id;
                if (action.clicked) {
                    button.disabled = true;
                    button.innerHTML = `${ICONS.check} ${sanitize(action.text)}`;
                } else {
                    button.textContent = action.text;
                }
                actionsContainer.appendChild(button);
            });
            bubble.appendChild(actionsContainer);
        }

        wrapper.appendChild(bubble);

        if (msg.sender === 'bot' && typeof msg.text === 'string' && !msg.text.includes('<div class="error-message">')) {
            const feedbackContainer = document.createElement('div');
            feedbackContainer.className = 'feedback-buttons';
            
            const isFeedbackDisabled = msg.feedback !== undefined;

            const upButton = document.createElement('button');
            upButton.className = `feedback-button ${msg.feedback === 'up' ? 'selected' : ''} ${isFeedbackDisabled ? 'disabled' : ''}`;
            upButton.innerHTML = ICONS.thumbUp;
            upButton.dataset.messageId = msg.id;
            upButton.dataset.feedback = 'up';
            if (isFeedbackDisabled) upButton.disabled = true;

            const downButton = document.createElement('button');
            downButton.className = `feedback-button ${msg.feedback === 'down' ? 'selected' : ''} ${isFeedbackDisabled ? 'disabled' : ''}`;
            downButton.innerHTML = ICONS.thumbDown;
            downButton.dataset.messageId = msg.id;
            downButton.dataset.feedback = 'down';
            if (isFeedbackDisabled) downButton.disabled = true;

            feedbackContainer.appendChild(upButton);
            feedbackContainer.appendChild(downButton);
            wrapper.appendChild(feedbackContainer);
        }

        container.appendChild(wrapper);
    });

    if (state.isTyping) {
        container.innerHTML += `
            <div class="message-wrapper bot">
                <div class="message-bubble bot typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>`;
    }

    container.scrollTop = container.scrollHeight;
}

// --- LOGIC & EVENT HANDLERS ---
function setState(newState) {
    const oldState = { ...state };
    state = { ...state, ...newState };
    
    if (JSON.stringify(oldState.messages) !== JSON.stringify(state.messages) || oldState.isTyping !== state.isTyping) {
        renderMessages();
    }
    updateChatUI();
    
    const isInitialState = state.messages.length === initialMessages.length &&
                           state.messages.every((msg, i) => msg.id === initialMessages[i].id);

    if (!isInitialState) {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify({
            messages: state.messages,
            conversationStep: state.conversationStep
        }));
    }
}

function updateChatUI() {
    if (!dom.messageInput) return;

    dom.messageInput.placeholder = "Mensagem";

    const hasInput = state.inputValue.trim() !== '' || state.attachedFile;
    const isBotTyping = state.isTyping;
    const isUserRecording = state.isRecording;
    const isUserTranscribing = state.isTranscribing;

    // Button visibility
    if (isUserRecording || isUserTranscribing) {
        dom.sendButton.style.display = 'none';
        dom.recordButton.style.display = 'flex';
    } else if (hasInput || isBotTyping) {
        dom.sendButton.style.display = 'flex';
        dom.recordButton.style.display = 'none';
    } else {
        dom.sendButton.style.display = 'none';
        dom.recordButton.style.display = 'flex';
    }

    // Button content and styles
    dom.sendButton.innerHTML = isBotTyping ? ICONS.loadingSpinner : ICONS.send;
    
    if (isUserRecording) {
        dom.recordButton.innerHTML = ICONS.stop;
        dom.recordButton.classList.add('recording');
    } else if (isUserTranscribing) {
        dom.recordButton.innerHTML = ICONS.loadingSpinner;
        dom.recordButton.classList.remove('recording');
    } else {
        dom.recordButton.innerHTML = ICONS.microphone;
        dom.recordButton.classList.remove('recording');
    }

    // Disabled states for inputs
    const isBusy = isBotTyping || isUserRecording || isUserTranscribing;
    dom.messageInput.disabled = isBusy;
    dom.attachButton.disabled = isBusy;
    dom.sendButton.disabled = isBotTyping || !hasInput;
    dom.recordButton.disabled = isBotTyping || isUserTranscribing;
    
    // Adjust textarea height
    dom.messageInput.style.height = 'auto';
    dom.messageInput.style.height = `${dom.messageInput.scrollHeight}px`;
}

function addMessage(sender, content) {
    const newMessage = { id: Date.now() + Math.random(), sender, ...content };
    
    const isInitialState = state.messages.length === initialMessages.length &&
                           state.messages.every((msg, i) => msg.id === initialMessages[i].id);

    if (sender === 'user' && isInitialState) {
        setState({ messages: [newMessage] });
    } else {
        setState({ messages: [...state.messages, newMessage] });
    }
}

function resetChat() {
    localStorage.removeItem(CHAT_HISTORY_KEY);
    setState({
        messages: [...initialMessages],
        conversationStep: 'done',
        inputValue: '',
        attachedFile: null,
        isTyping: false,
    });
    if (dom.messageInput) {
        dom.messageInput.value = '';
    }
    updateAttachmentPreview();
}

async function handleGenericSubmit(prompt, imageFile) {
    const userMessageContent = {};
    if (prompt) userMessageContent.text = prompt;
    if (imageFile) {
        userMessageContent.imageUrl = `data:${imageFile.mimeType};base64,${imageFile.data}`;
    }

    addMessage('user', userMessageContent);
    setState({ inputValue: '', attachedFile: null, isTyping: true });
    if(dom.messageInput) dom.messageInput.value = '';
    updateAttachmentPreview();

    try {
        const chatHistory = state.messages.slice(0, -1);
        const botResponse = await getMistralChatCompletion(prompt, imageFile, chatHistory);
        
        if (botResponse) {
            addMessage('bot', { text: botResponse });
        } else {
            throw new Error("Invalid response structure from API");
        }
    } catch (error) {
        console.error("API call failed", error);
        const retryId = `retry-${Date.now()}`;
        const errorMessageHTML = `
            <div class="error-message">
                <p>${error.message || 'Desculpe, algo deu errado.'}</p>
                <button class="retry-button" id="${retryId}">Tentar Novamente</button>
            </div>`;
        addMessage('bot', { text: errorMessageHTML });
        
        setTimeout(() => {
            document.getElementById(retryId)?.addEventListener('click', () => {
                const newMessages = state.messages.slice(0, -2); // Remove user and error message
                setState({ messages: newMessages });
                handleGenericSubmit(prompt, imageFile);
            });
        }, 0);
    } finally {
        setState({ isTyping: false });
    }
}

function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setState({
                attachedFile: {
                    data: (reader.result).split(',')[1],
                    mimeType: file.type,
                    name: file.name
                }
            });
            updateAttachmentPreview();
        };
        reader.readAsDataURL(file);
    } else if (file) {
        alert("Por favor, selecione um arquivo de imagem.");
    }
    if (event.target) event.target.value = '';
}

function updateAttachmentPreview() {
    if (!dom.attachmentPreview) return;
    const preview = dom.attachmentPreview;
    if (state.attachedFile) {
        const imageUrl = `data:${state.attachedFile.mimeType};base64,${state.attachedFile.data}`;
        preview.innerHTML = `
            <img src="${imageUrl}" alt="Anexo">
            <span>${sanitize(state.attachedFile.name)}</span>
            <button type="button" id="remove-attachment-button" aria-label="Remover anexo">
                ${ICONS.xCircle}
            </button>
        `;
        preview.style.display = 'flex';
        const removeButton = document.getElementById('remove-attachment-button');
        if (removeButton) {
            removeButton.addEventListener('click', () => {
                setState({ attachedFile: null });
                updateAttachmentPreview();
            });
        }
    } else {
        preview.innerHTML = '';
        preview.style.display = 'none';
    }
}

function addEventListeners() {
    dom.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (state.isTyping || (!state.inputValue.trim() && !state.attachedFile)) return;
        handleGenericSubmit(state.inputValue.trim(), state.attachedFile);
    });

    dom.messageInput.addEventListener('input', (e) => {
        setState({ inputValue: e.target.value });
    });

    dom.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            dom.chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    });

    dom.newChatButton.addEventListener('click', resetChat);

    dom.attachButton.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', handleFileChange);
    
    dom.recordButton.addEventListener('click', () => {
        if (state.isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    dom.chatMessages.addEventListener('click', (e) => {
        const copyButton = e.target.closest('.copy-button');
        if (copyButton && !copyButton.disabled) {
            navigator.clipboard.writeText(copyButton.dataset.code);
            copyButton.disabled = true;
            const textEl = copyButton.querySelector('.copy-text');
            const iconEl = copyButton.querySelector('.copy-icon');
            if (textEl) textEl.textContent = 'Copiado!';
            if (iconEl) iconEl.innerHTML = ICONS.check;
            setTimeout(() => {
                copyButton.disabled = false;
                if (textEl) textEl.textContent = 'Copiar';
                if (iconEl) iconEl.innerHTML = ICONS.clipboard;
            }, 2000);
        }
        
        const actionButton = e.target.closest('.action-button');
        if (actionButton && !actionButton.disabled) {
            const { messageId, actionId } = actionButton.dataset;
            const messages = state.messages.map(msg => {
                if (String(msg.id) === messageId) {
                    const updatedActions = msg.actions.map(act => 
                        act.id === actionId ? { ...act, clicked: true } : act
                    );
                    return { ...msg, actions: updatedActions };
                }
                return msg;
            });
            setState({ messages });

            const message = state.messages.find(msg => String(msg.id) === messageId);
            const action = message?.actions.find(act => act.id === actionId);
            
            if (action) {
                addMessage('user', { text: `Cliquei em: ${action.text}` });
                setState({ isTyping: true });
                setTimeout(() => {
                     addMessage('bot', { text: `Você realizou a ação: "${action.text}". Como posso prosseguir?` });
                     setState({ isTyping: false });
                }, 1500);
            }
        }
        
        const feedbackButton = e.target.closest('.feedback-button');
        if (feedbackButton && !feedbackButton.disabled) {
            const { messageId, feedback } = feedbackButton.dataset;
            const messages = state.messages.map(msg => {
                if (String(msg.id) === messageId) {
                    return { ...msg, feedback };
                }
                return msg;
            });
            setState({ messages });
        }
    });
}

function init() {
    const savedState = localStorage.getItem(CHAT_HISTORY_KEY);
    if (savedState) {
        try {
            const { messages, conversationStep } = JSON.parse(savedState);
            if (Array.isArray(messages)) {
                state.messages = messages;
                state.conversationStep = conversationStep || 'done';
            } else {
                 state.messages = [...initialMessages];
            }
        } catch (e) {
             console.error("Failed to parse chat history", e);
             state.messages = [...initialMessages];
        }
    } else {
        state.messages = [...initialMessages];
    }
    addEventListeners();
    renderMessages();
    updateChatUI();
}

document.addEventListener('DOMContentLoaded', init);
