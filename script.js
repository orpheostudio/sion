import { GoogleGenAI, Modality } from '@google/genai';

const CHAT_HISTORY_KEY = 'cici-chat-history';
const IMAGE_QUOTA_KEY = 'cici-image-quota';
const MAX_IMAGES = 4;
const QUOTA_PERIOD = 24 * 60 * 60 * 1000; // 24 hours

// --- ICONS ---
const ICONS = {
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clip-rule="evenodd" /></svg>`,
  send: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>`,
  speakerWave: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>`,
  stop: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" /></svg>`,
  loadingSpinner: `<svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`,
  xCircle: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
  clipboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3A1.5 1.5 0 0 1 13 3.5v1A1.5 1.5 0 0 1 11.5 6h-3A1.5 1.5 0 0 1 7 4.5v-1Z" /><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 15.5v-9Z" /></svg>`
};

// --- DOM ELEMENTS ---
const appContent = document.getElementById('app-content');
let dom = {}; // To be populated when a screen is rendered

// --- STATE ---
const initialMessages = [
    { id: 1, sender: 'bot', text: 'Hi! How can I assist you today? 😊' },
    { id: 2, sender: 'bot', text: 'Feel free to ask me anything!' }
];

let state = {
  appState: 'chat',
  messages: [],
  conversationStep: 'done',
  inputValue: '',
  isTyping: false,
  attachedFile: null,
  isTtsEnabled: true,
  playingMessageId: null,
  isAudioLoading: false,
};

// --- AUDIO UTILITIES & TTS ---
let audioPlayer = null;
let audioContext = null;

function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
}

function decodeBase64(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data) {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = audioContext.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
}

function stopCurrentAudio() {
    if (audioPlayer) {
        try {
            audioPlayer.stop();
        } catch (e) {
            // Ignore errors if already stopped
        }
        audioPlayer.disconnect();
        audioPlayer = null;
    }
    state.playingMessageId = null;
    state.isAudioLoading = false;
    renderMessages();
}

async function playTextToSpeech(text) {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Say cheerfully: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio && audioContext) {
            const audioBuffer = await decodeAudioData(decodeBase64(base64Audio));
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.onended = stopCurrentAudio;
            source.start();
            audioPlayer = source;
        } else {
            throw new Error("No audio data received.");
        }
    } catch (error) {
        console.error("TTS generation failed:", error);
        stopCurrentAudio();
    }
}

// --- IMAGE QUOTA ---
const imageGenerationQuota = {
    get: () => {
        const stored = localStorage.getItem(IMAGE_QUOTA_KEY);
        if (!stored) return { count: MAX_IMAGES, resetTime: Date.now() + QUOTA_PERIOD };
        const quota = JSON.parse(stored);
        if (Date.now() > quota.resetTime) {
            return { count: MAX_IMAGES, resetTime: Date.now() + QUOTA_PERIOD };
        }
        return quota;
    },
    use: () => {
        let quota = imageGenerationQuota.get();
        if (quota.count > 0) {
            quota.count -= 1;
            localStorage.setItem(IMAGE_QUOTA_KEY, JSON.stringify(quota));
            return true;
        }
        return false;
    }
};

// --- TEMPLATES / RENDER FUNCTIONS ---
function sanitize(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

window.handleCopyCode = function(button, code) {
    const iconSpan = button.querySelector('.copy-icon');
    const textSpan = button.querySelector('.copy-text');
    
    navigator.clipboard.writeText(code).then(() => {
        if (iconSpan) iconSpan.innerHTML = ICONS.check;
        if (textSpan) textSpan.textContent = 'Copiado!';
        button.disabled = true;
        setTimeout(() => {
            if (iconSpan) iconSpan.innerHTML = ICONS.clipboard;
            if (textSpan) textSpan.textContent = 'Copiar';
            button.disabled = false;
        }, 2000);
    }).catch(() => {
        if (textSpan) textSpan.textContent = 'Falhou!';
        setTimeout(() => {
            if (textSpan) textSpan.textContent = 'Copiar';
        }, 2000);
    });
}

function renderFormattedText(text) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map(part => {
        if (part.startsWith('```') && part.endsWith('```')) {
            const code = part.slice(3, -3).trim();
            const langMatch = code.match(/^[a-z]+\n/);
            const lang = langMatch ? langMatch[0].trim() : 'code';
            const codeContent = langMatch ? code.substring(lang.length + 1) : code;
            
            // Escape backticks and backslashes for the inline onclick handler
            const escapedCode = codeContent.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
            
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span>${sanitize(lang)}</span>
                        <button class="copy-button" onclick="handleCopyCode(this, \`${escapedCode}\`)">
                            <span class="copy-icon">${ICONS.clipboard}</span>
                            <span class="copy-text">Copiar</span>
                        </button>
                    </div>
                    <pre><code>${sanitize(codeContent)}</code></pre>
                </div>`;
        }
        let html = sanitize(part);
        // Bold: **text** -> <strong>text</strong>
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic: *text* -> <em>text</em>
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // New lines
        html = html.replace(/\n/g, '<br>');
        return html;
    }).join('');
}

function renderMessages() {
    if (state.appState !== 'chat') return;
    const container = dom.chatMessages;
    if (!container) return;

    container.innerHTML = '';
    let lastSender = null;

    // Conditionally render the intro header
    if (state.messages.length <= 2 && state.messages[0]?.id === 1) {
        container.innerHTML += `
            <div id="chat-intro-header" class="chat-intro-header">
                <img src="https://i.imgur.com/uoWlYN7.jpeg" alt="Cici Avatar" class="intro-avatar">
                <h1 class="intro-title">Cici</h1>
                <p class="intro-subtitle">Your chatbot assistant</p>
            </div>`;
    }

    state.messages.forEach(msg => {
        const isBot = msg.sender === 'bot';
        
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${msg.sender}`;

        let content = '';
        if (isBot) {
            // Avatar is not shown for bot messages in the new design
        } else {
             content += `<button class="audio-button user-audio-button" data-message-id="${msg.id}">${getAudioButtonIcon(msg.id)}</button>`;
        }
        
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${msg.sender}`;

        if (msg.imageUrl) {
            bubble.innerHTML += `<img src="${msg.imageUrl}" alt="Chat content">`;
        }
        if (msg.text) {
            bubble.innerHTML += typeof msg.text === 'string' ? renderFormattedText(msg.text) : msg.text;
        }
        
        wrapper.innerHTML = content;
        wrapper.appendChild(bubble);

        if (isBot) {
            bubble.insertAdjacentHTML('afterend', `<button class="audio-button bot-audio-button" data-message-id="${msg.id}">${getAudioButtonIcon(msg.id)}</button>`);
        }

        container.appendChild(wrapper);
        lastSender = msg.sender;
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

function getAudioButtonIcon(messageId) {
    if (typeof messageId !== 'number') return ''; // Avoid rendering for non-string messages
    const isCurrent = state.playingMessageId === messageId;
    if (state.isAudioLoading && isCurrent) return ICONS.loadingSpinner;
    if (isCurrent) return ICONS.stop;
    return ICONS.speakerWave;
}

// --- LOGIC & EVENT HANDLERS ---

function setState(newState) {
    const oldState = { ...state };
    state = { ...state, ...newState };
    
    if (oldState.appState !== state.appState) {
        render();
    } else {
        if (JSON.stringify(oldState.messages) !== JSON.stringify(state.messages) || oldState.isTyping !== state.isTyping) {
            renderMessages();
        }
        updateChatUI();
    }
    
    if (state.appState === 'chat' && state.messages.length > initialMessages.length) {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify({
            messages: state.messages,
            conversationStep: state.conversationStep
        }));
    }
}

function updateChatUI() {
    if (state.appState !== 'chat' || !dom.messageInput) return;

    dom.messageInput.placeholder = "Message";

    if (state.isTyping) {
        dom.sendButton.disabled = true;
        dom.sendButton.innerHTML = ICONS.loadingSpinner;
    } else {
        const canSend = state.inputValue.trim() || state.attachedFile;
        dom.sendButton.disabled = !canSend;
        dom.sendButton.innerHTML = ICONS.send;
    }

    dom.messageInput.style.height = 'auto';
    dom.messageInput.style.height = `${dom.messageInput.scrollHeight}px`;
}

function addMessage(sender, content) {
    const newMessage = { id: Date.now() + Math.random(), sender, ...content };
    
    // If the chat has only initial messages, replace them with the new flow
    if (state.messages.length === 2 && state.messages[0].id === 1) {
         setState({ messages: [newMessage] });
    } else {
         setState({ messages: [...state.messages, newMessage] });
    }
}

function resetChat() {
    stopCurrentAudio();
    localStorage.removeItem(CHAT_HISTORY_KEY);
    setState({
        messages: [...initialMessages],
        conversationStep: 'done',
        inputValue: '',
        appState: 'chat'
    });
}

async function handleGenericSubmit(prompt, file) {
    const userMessageContent = {};
    if (prompt) userMessageContent.text = prompt;
    if (file) userMessageContent.imageUrl = `data:${file.mimeType};base64,${file.data}`;

    addMessage('user', userMessageContent);
    setState({ inputValue: '', attachedFile: null, isTyping: true });
    updateAttachmentPreview();

    const imageGenRegex = /^(crie|gere|desenhe|faça)\s+(uma|um)\s+(imagem|desenho|foto)/i;

    try {
        if (imageGenRegex.test(prompt) && !file) {
            const quota = imageGenerationQuota.get();
            if (imageGenerationQuota.use()) {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [{ text: prompt }] },
                    config: { responseModalities: [Modality.IMAGE] },
                });
                const firstPart = response.candidates?.[0]?.content?.parts?.[0];
                if (firstPart?.inlineData) {
                    addMessage('bot', { imageUrl: `data:image/png;base64,${firstPart.inlineData.data}` });
                } else {
                    throw new Error("Nenhuma imagem foi gerada.");
                }
            } else {
                addMessage('bot', { text: `Desculpe, você atingiu seu limite de ${MAX_IMAGES} imagens por 24 horas. Seu limite será zerado em ${new Date(quota.resetTime).toLocaleTimeString()}.` });
            }
        } else {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const modelParts = [];
            if (prompt) modelParts.push({ text: prompt });
            if (file) modelParts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });

            const systemInstruction = "Você é a Cici, uma assistente de IA especialista em programação. Seu tom é amigável e encorajador. Ao fornecer código, sempre use blocos de código markdown (```) e especifique a linguagem (por exemplo, ```javascript) para formatação. Explique o código de forma clara e concisa.";
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: modelParts },
                config: { systemInstruction },
            });
            const botResponse = response.text;
            if (botResponse) {
                addMessage('bot', { text: botResponse });
            } else {
                throw new Error("Invalid response structure from API");
            }
        }
    } catch (error) {
        console.error("API call failed", error);
        const retryId = `retry-${Date.now()}`;
        const errorMessageHTML = `
            <div class="error-message">
                <p>Desculpe, algo deu errado.</p>
                <button class="retry-button" id="${retryId}">Tentar Novamente</button>
            </div>`;
        addMessage('bot', { text: errorMessageHTML });
        
        setTimeout(() => {
            document.getElementById(retryId)?.addEventListener('click', () => {
                const newMessages = state.messages.slice(0, -2);
                setState({ messages: newMessages });
                handleGenericSubmit(prompt, file);
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
    if (event.target) event.target.value = ''; // Reset file input
}

function updateAttachmentPreview() {
    if (state.appState !== 'chat') return;
    const preview = dom.attachmentPreview;
    if (state.attachedFile) {
        preview.innerHTML = `
            <img src="data:${state.attachedFile.mimeType};base64,${state.attachedFile.data}" alt="Preview" />
            <span>${sanitize(state.attachedFile.name)}</span>
            <button id="remove-attachment-button">${ICONS.xCircle}</button>
        `;
        preview.style.display = 'flex';
        document.getElementById('remove-attachment-button').addEventListener('click', () => {
            setState({ attachedFile: null });
            updateAttachmentPreview();
        });
    } else {
        preview.style.display = 'none';
        preview.innerHTML = '';
    }
    updateChatUI();
}

// --- MAIN RENDER & BINDING ---

function render() {
    // The main screen is now in index.html, so we don't need to render it.
    bindDOM();
    renderMessages();
    updateChatUI();
}

function bindDOM() {
    dom = {}; // Reset DOM references
    if (state.appState === 'chat') {
        dom.chatMessages = document.getElementById('chat-messages');
        dom.chatForm = document.getElementById('chat-form');
        dom.messageInput = document.getElementById('message-input');
        dom.sendButton = document.getElementById('send-button');
        dom.attachButton = document.getElementById('attach-button');
        dom.fileInput = document.getElementById('file-input');
        dom.attachmentPreview = document.getElementById('attachment-preview');
        
        dom.messageInput.focus();

        dom.messageInput.addEventListener('input', e => setState({ inputValue: e.target.value }));
        dom.messageInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                dom.chatForm.requestSubmit();
            }
        });
        
        dom.chatForm.addEventListener('submit', e => {
            e.preventDefault();
            if (state.isTyping || (!state.inputValue.trim() && !state.attachedFile)) return;
            handleGenericSubmit(state.inputValue, state.attachedFile);
        });

        dom.attachButton.addEventListener('click', () => dom.fileInput.click());
        dom.fileInput.addEventListener('change', handleFileChange);
        
        dom.chatMessages.addEventListener('click', async e => {
            const audioButton = e.target.closest('.audio-button');
            if (audioButton) {
                if (!state.isTtsEnabled) return;
                const messageId = Number(audioButton.dataset.messageId);
                const message = state.messages.find(m => m.id === messageId);
                if (message && typeof message.text === 'string' && message.text.trim()) {
                    if (state.playingMessageId === messageId) {
                        stopCurrentAudio();
                    } else {
                        stopCurrentAudio();
                        setState({ playingMessageId: messageId, isAudioLoading: true });
                        await playTextToSpeech(message.text);
                        setState({ isAudioLoading: false });
                    }
                }
            }
            const suggestionChip = e.target.closest('.suggestion-chip');
            if (suggestionChip) {
                handleGenericSubmit(suggestionChip.dataset.prompt, null);
            }
        });
    }
}

// --- INITIALIZATION ---
function init() {
    initAudioContext();
    
    const saved = localStorage.getItem(CHAT_HISTORY_KEY);
    let initialState = {};
    if (saved) {
        try {
            initialState = JSON.parse(saved);
            if (!initialState.messages || initialState.messages.length === 0) {
                 initialState.messages = [...initialMessages];
            }
        } catch (error) {
            console.error("Failed to parse chat history", error);
            localStorage.removeItem(CHAT_HISTORY_KEY);
            initialState.messages = [...initialMessages];
        }
    } else {
        initialState.messages = [...initialMessages];
    }
    
    setState({
        ...state,
        ...initialState,
        appState: 'chat',
        conversationStep: 'done',
    });
}

document.addEventListener('DOMContentLoaded', init);