
import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
// FIX: Import `GoogleGenAI` and `Modality` from `@google/genai`.
import { GoogleGenAI, Modality } from '@google/genai';
import { AppState, Message, ConversationStep } from './types';
import { CheckIcon, SendIcon, InfoIcon, SparklesIcon, RestartIcon, BugAntIcon, SpeakerWaveIcon, StopIcon, LoadingSpinner, PaperClipIcon, XCircleIcon, CodeBracketIcon, Bars3Icon, SpeakerXMarkIcon } from './components/icons';

const CHAT_HISTORY_KEY = 'sena-chat-history';

// --- Image Quota Management ---
const IMAGE_QUOTA_KEY = 'sena-image-quota';
const MAX_IMAGES = 4;
const QUOTA_PERIOD = 24 * 60 * 60 * 1000; // 24 hours

const imageGenerationQuota = {
  get: () => {
    const storedQuota = localStorage.getItem(IMAGE_QUOTA_KEY);
    if (!storedQuota) {
      return { count: MAX_IMAGES, resetTime: Date.now() + QUOTA_PERIOD };
    }
    const quota = JSON.parse(storedQuota);
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

// --- Audio Utility Functions ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / 1;
  const buffer = ctx.createBuffer(1, frameCount, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

// --- Helper Components defined outside the main App component ---

const Avatar = ({ size }: { size: 'sm' | 'lg' }) => {
  const sizeClasses = size === 'sm' ? 'w-10 h-10' : 'w-32 h-32';
  return (
    <div className={`relative ${sizeClasses}`}>
      <div className={`absolute inset-0 bg-purple-300 rounded-full ${size === 'lg' ? 'p-1' : ''}`}>
        <div className="w-full h-full bg-purple-400 rounded-full flex items-center justify-center">
            <img src="https://i.imgur.com/iVFhqIl.png" alt="Sena Avatar" className="w-full h-full object-cover rounded-full" />
        </div>
      </div>
    </div>
  );
};

const FormattedTextMessage = ({ text }: { text: string }) => {
    if (!text.includes('```')) {
        return <>{text}</>;
    }

    const parts = text.split(/(```[\s\S]*?```)/g);

    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('```') && part.endsWith('```')) {
                    const code = part.slice(3, -3).trim();
                    const langMatch = code.match(/^[a-z]+\n/);
                    const lang = langMatch ? langMatch[0].trim() : 'code';
                    const codeContent = langMatch ? code.substring(lang.length + 1) : code;
                    
                    return (
                        <div key={index} className="bg-gray-800 text-white rounded-md my-2 text-left">
                            <div className="bg-gray-700 px-4 py-1.5 rounded-t-md text-xs font-sans text-gray-300 flex justify-between items-center">
                                <span>{lang}</span>
                                <button onClick={() => navigator.clipboard.writeText(codeContent)} className="text-xs hover:text-white transition-colors">Copiar</button>
                            </div>
                            <pre className="p-4 text-xs whitespace-pre-wrap overflow-x-auto">
                                <code>{codeContent}</code>
                            </pre>
                        </div>
                    );
                }
                return <span key={index}>{part}</span>;
            })}
        </>
    );
};

interface ChatMessageProps {
  message: Message;
  showAvatar: boolean;
  onPlayAudio: (text: string, messageId: number) => void;
  playingMessageId: number | null;
  isAudioLoading: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, showAvatar, onPlayAudio, playingMessageId, isAudioLoading }) => {
  const isBot = message.sender === 'bot';

  const botBubbleClasses = "bg-gray-200/60 text-gray-800 rounded-lg";
  const userBubbleClasses = "bg-indigo-600 text-white rounded-lg";
  
  const canPlayAudio = typeof message.text === 'string' && message.text.trim().length > 0;
  const textContent = typeof message.text === 'string' ? message.text : '';

  const AudioButton = () => {
    if (!canPlayAudio) return null;

    const isCurrentMessagePlaying = playingMessageId === message.id;

    const handleClick = () => {
      onPlayAudio(textContent, message.id);
    };

    let icon;
    if (isAudioLoading && isCurrentMessagePlaying) {
        icon = <LoadingSpinner className="w-4 h-4 text-gray-500" />;
    } else if (isCurrentMessagePlaying) {
        icon = <StopIcon className="w-5 h-5 text-gray-500" />;
    } else {
        icon = <SpeakerWaveIcon className="w-5 h-5 text-gray-500" />;
    }

    return (
      <button 
        onClick={handleClick} 
        className="p-2 rounded-full hover:bg-gray-200/80 transition-colors self-start flex-shrink-0"
        aria-label={isCurrentMessagePlaying ? "Stop audio" : "Play audio"}
      >
        {icon}
      </button>
    );
  };

  const MessageContent = () => (
    <>
      {message.imageUrl && <img src={message.imageUrl} alt="Chat content" className="rounded-lg max-w-full h-auto mb-2" />}
      {typeof message.text === 'string' ? <FormattedTextMessage text={message.text} /> : message.text}
    </>
  );

  return (
    <div className={`flex items-end gap-2 ${!isBot ? 'justify-end' : ''}`}>
      {isBot && (
        <div className="w-8 flex-shrink-0 mb-1">
          {showAvatar && <img src="https://i.imgur.com/iVFhqIl.png" alt="Sena Avatar" className="w-full h-full object-cover rounded-full" />}
        </div>
      )}
      {!isBot && <AudioButton />}
      <div className={`max-w-[80%] p-3 px-4 shadow-sm ${isBot ? botBubbleClasses : userBubbleClasses}`}>
        <div className="text-sm prose-sm max-w-none"><MessageContent /></div>
      </div>
       {isBot && <AudioButton />}
    </div>
  );
};

const AboutSenaGuide = () => (
    <div className="mt-6 w-full max-w-xs text-left p-4 bg-white/50 rounded-lg border border-gray-200/80 backdrop-blur-sm space-y-4">
        <div>
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <InfoIcon className="w-5 h-5 text-indigo-500" />
              Nossa Missão
            </h3>
            <p className="text-xs text-gray-600">
                Facilitar o acesso à tecnologia para todos, unindo simplicidade, autonomia e inclusão digital. A Sena transforma tarefas complexas em experiências intuitivas, rápidas e acessíveis.
            </p>
        </div>
        <div>
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-indigo-500" />
              O que posso fazer por você?
            </h3>
            <ul className="space-y-2 text-xs text-gray-600 pl-1">
                <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">&bull;</span>
                    <span><strong>Responder dúvidas</strong> sobre qualquer assunto.</span>
                </li>
                 <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">&bull;</span>
                    <span><strong>Ensinar a usar</strong> aplicativos e dispositivos.</span>
                </li>
                <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">&bull;</span>
                    <span><strong>Organizar seu dia</strong> com lembretes e calendários.</span>
                </li>
                 <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">&bull;</span>
                    <span><strong>Recomendar</strong> animes, mangás e muito mais!</span>
                </li>
            </ul>
        </div>
    </div>
  );

const SuggestionChips = ({ onChipClick }: { onChipClick: (text: string) => void }) => {
    const suggestions = [
        "Crie uma imagem de um gato astronauta",
        "Como eu centralizo uma div em CSS?",
        "Me dê uma receita simples de bolo de chocolate"
    ];
    return (
        <div className="flex flex-col items-start gap-2">
            {suggestions.map((s) => (
                <button 
                  key={s} 
                  onClick={() => onChipClick(s)} 
                  className="text-sm bg-white border border-gray-300 rounded-full px-4 py-1.5 hover:bg-gray-100 transition-colors text-indigo-700 font-medium"
                >
                    {s}
                </button>
            ))}
        </div>
    );
};

// --- Main App Component ---

type AttachedFile = { data: string; mimeType: string; name: string };

export default function App() {
  const [appState, setAppState] = useState<AppState>('welcome');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationStep, setConversationStep] = useState<ConversationStep>('name');
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userName, setUserName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [promptToRetry, setPromptToRetry] = useState<{ prompt: string; file: AttachedFile | null } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // TTS State
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const audioPlayer = useRef<AudioBufferSourceNode | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }, []);

  useEffect(() => {
    const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        if (parsedHistory.messages && parsedHistory.messages.length > 0) {
          setMessages(parsedHistory.messages);
          setConversationStep(parsedHistory.conversationStep || 'name');
          setUserName(parsedHistory.userName || '');
          setAppState('chat');
        }
      } catch (error) {
        console.error("Failed to parse chat history from localStorage", error);
        localStorage.removeItem(CHAT_HISTORY_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (appState === 'welcome') {
      const timer = setTimeout(() => setIsWelcomeVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsWelcomeVisible(false);
    }
  }, [appState]);

  useEffect(() => {
    if (appState === 'chat' && messages.length > 0) {
      const chatHistory = {
        messages,
        conversationStep,
        userName,
      };
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
    }
  }, [messages, conversationStep, userName, appState]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [inputValue]);
  
  const stopCurrentAudio = () => {
    if (audioPlayer.current) {
        audioPlayer.current.stop();
        audioPlayer.current.disconnect();
        audioPlayer.current = null;
    }
    setPlayingMessageId(null);
    setIsAudioLoading(false);
  };

  const playTextToSpeech = async (text: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: `Say cheerfully: ${text}` }] }],
          config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                  voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Kore' },
                  },
              },
          },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio && audioContext.current) {
          const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext.current);
          const source = audioContext.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.current.destination);
          source.onended = () => {
              stopCurrentAudio();
          };
          source.start();
          audioPlayer.current = source;
      } else {
          throw new Error("No audio data received.");
      }
    } catch (error) {
        console.error("TTS generation failed:", error);
        stopCurrentAudio();
    }
  };

  const handlePlayAudio = async (text: string, messageId: number) => {
    if (!isTtsEnabled) return;
    if (playingMessageId === messageId) {
        stopCurrentAudio();
    } else {
        stopCurrentAudio();
        setPlayingMessageId(messageId);
        setIsAudioLoading(true);
        await playTextToSpeech(text);
        setIsAudioLoading(false);
    }
  };

  const addMessage = (sender: 'bot' | 'user', content: { text?: string | React.ReactNode; imageUrl?: string }) => {
    setMessages(prev => [...prev, {
        id: Date.now() + Math.random(),
        sender,
        ...content
    }]);
  };

  const resetChat = () => {
    stopCurrentAudio();
    localStorage.removeItem(CHAT_HISTORY_KEY);
    setMessages([]);
    setConversationStep('name');
    setInputValue('');
    setUserName('');
  };

  const startChat = () => {
    setAppState('chat');
    setIsTyping(true);
    setTimeout(() => addMessage('bot', { text: "Olá!" }), 500);
    setTimeout(() => addMessage('bot', { text: "Eu sou a Sena." }), 1500);
    setTimeout(() => {
      addMessage('bot', { text: "Como devo te chamar?" });
      setIsTyping(false);
    }, 2500);
  };

  const handleSuggestionClick = (prompt: string) => {
    setIsMenuOpen(false); // Close menu on click
    handleGenericSubmit(prompt, null);
  };

  const handleNameSubmit = (name: string) => {
    const displayName = name.trim() === '' ? "amigo(a)" : name.trim();
    setUserName(displayName);
    addMessage('user', { text: displayName === "amigo(a)" ? "Prefiro não dizer" : name });
    setInputValue('');
    setConversationStep('done');
    setIsTyping(true);

    setTimeout(() => {
        addMessage('bot', { text: `Prazer em te conhecer, ${displayName}!` });
    }, 1000);
    setTimeout(() => {
        addMessage('bot', { text: "O que posso fazer por você hoje?" });
    }, 2000);
    setTimeout(() => {
        addMessage('bot', { text: <SuggestionChips onChipClick={handleSuggestionClick} /> });
        setIsTyping(false);
    }, 3000);
  };

  const handleGenericSubmit = useCallback(async (prompt: string, file: AttachedFile | null) => {
    const userMessageContent: { text?: string; imageUrl?: string } = {};
    if (prompt) userMessageContent.text = prompt;
    if (file) userMessageContent.imageUrl = `data:${file.mimeType};base64,${file.data}`;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'user' && lastMessage.text === prompt) {
        // This is likely a retry, don't add duplicate user message
    } else {
        addMessage('user', userMessageContent);
    }
    
    setInputValue('');
    setAttachedFile(null);
    setIsTyping(true);

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
                if (firstPart && firstPart.inlineData) {
                    const base64Image = firstPart.inlineData.data;
                    addMessage('bot', { imageUrl: `data:image/png;base64,${base64Image}` });
                } else {
                    throw new Error("Nenhuma imagem foi gerada.");
                }
            } else {
                addMessage('bot', { text: `Desculpe, você atingiu seu limite de ${MAX_IMAGES} imagens por 24 horas. Seu limite será zerado em ${new Date(quota.resetTime).toLocaleTimeString()}.` });
            }
        } else {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const modelParts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
            if (prompt) modelParts.push({ text: prompt });
            if (file) modelParts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });

            const systemInstruction = "Você é a Sena, uma assistente de IA carismática e prestativa. Seu tom é amigável e encorajador, não corporativo. Você é uma programadora especialista e pode ajudar com perguntas sobre codificação, explicando conceitos, depurando código e gerando trechos de código. Ao fornecer código, formate-o claramente usando blocos de código markdown (```).";
            
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
        const ErrorMessageWithRetry: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
            <div>
                <p className="mb-2">Desculpe, algo deu errado.</p>
                <button
                    onClick={onRetry}
                    className="font-semibold text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-200 transition-colors"
                >
                    Tentar Novamente
                </button>
            </div>
        );
        const handleRetry = () => {
            setMessages(prev => prev.slice(0, -2));
            setPromptToRetry({ prompt, file });
        };
        addMessage('bot', { text: <ErrorMessageWithRetry onRetry={handleRetry} /> });
    } finally {
        setIsTyping(false);
    }
  }, [messages]);

  useEffect(() => {
    if (promptToRetry) {
        handleGenericSubmit(promptToRetry.prompt, promptToRetry.file);
        setPromptToRetry(null);
    }
  }, [promptToRetry, handleGenericSubmit]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && !attachedFile) || isTyping) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'bot' && typeof lastMessage.text !== 'string') {
        return;
    }

    switch (conversationStep) {
        case 'name':
            handleNameSubmit(inputValue);
            break;
        case 'done':
            handleGenericSubmit(inputValue, attachedFile);
            break;
    }
  };
  
  const handleFileSelect = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setAttachedFile({
                  data: (reader.result as string).split(',')[1],
                  mimeType: file.type,
                  name: file.name
              });
          };
          reader.readAsDataURL(file);
      } else if (file) {
          alert("Por favor, selecione um arquivo de imagem.");
      }
      if(event.target) event.target.value = '';
  };

  const removeAttachedFile = () => {
      setAttachedFile(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit(e as any);
    }
  };


  const renderWelcomeScreen = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 overflow-y-auto">
      <div className={`flex-shrink-0 transition-all duration-700 ease-out ${isWelcomeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <Avatar size="lg" />
      </div>
      <div className={`transition-all duration-700 ease-out delay-200 ${isWelcomeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-3xl font-bold text-gray-800 mt-8">Bem-vindo à Sena</h1>
        <p className="text-gray-500 mt-2 max-w-xs">Sua assistente para um mundo digital mais simples e acessível.</p>
      </div>
      <div className={`mt-10 w-full max-w-xs space-y-4 transition-all duration-700 ease-out delay-[400ms] ${isWelcomeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button
          onClick={() => setAppState('about')}
          className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105"
        >
          Saiba Mais
        </button>
      </div>
    </div>
  );
  
  const renderAboutScreen = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 overflow-y-auto">
      <div className="flex-shrink-0">
        <Avatar size="sm" />
        <h1 className="text-2xl font-bold text-gray-800 mt-6">Sua Guia para o Mundo Digital</h1>
      </div>
      <AboutSenaGuide />
      <div className="mt-8 w-full max-w-xs space-y-4">
        <button
          onClick={() => setAppState('terms')}
          className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105"
        >
          Continuar
        </button>
      </div>
    </div>
  );

  const renderTermsScreen = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 overflow-y-auto">
        <div className="flex-shrink-0">
            <Avatar size="sm" />
            <h1 className="text-2xl font-bold text-gray-800 mt-6">Antes de prosseguirmos</h1>
            <p className="text-gray-500 mt-2 text-sm max-w-xs">Por favor, reveja e aceite nossos termos para começar a conversar com a Sena.</p>
        </div>
        <div className="mt-8 w-full max-w-xs space-y-4">
            <div className="space-y-3 text-left text-sm text-gray-700">
                <label className="flex items-center gap-3 p-3 rounded-lg bg-white/60 border border-gray-200/80 cursor-pointer hover:bg-white transition-colors">
                    <input type="checkbox" checked={termsAccepted} onChange={() => setTermsAccepted(!termsAccepted)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0" />
                    <span>Eu li e concordo com os <a href="https://termos.orpheostudio.com.br" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 hover:underline">Termos de Uso</a></span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg bg-white/60 border border-gray-200/80 cursor-pointer hover:bg-white transition-colors">
                    <input type="checkbox" checked={policyAccepted} onChange={() => setPolicyAccepted(!policyAccepted)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0" />
                    <span>Eu li e concordo com as <a href="https://politicas.orpheostudio.com.br" target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 hover:underline">Políticas de Privacidade</a></span>
                </label>
            </div>
            <button
                onClick={() => {
                    resetChat();
                    startChat();
                }}
                disabled={!termsAccepted || !policyAccepted}
                className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
            >
                Começar
            </button>
        </div>
    </div>
  );

  const renderChatScreen = () => {
    const getInputPlaceholder = () => {
        switch(conversationStep) {
            case 'name': return "Digite seu nome...";
            case 'done': return "Envie uma mensagem ou anexe uma imagem...";
            default: return "";
        }
    }

    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="relative p-4 border-b border-gray-200/80 flex items-center gap-3 bg-white/80 backdrop-blur-sm z-10 flex-shrink-0">
            <img src="https://i.imgur.com/iVFhqIl.png" alt="Sena Logo" className="w-8 h-8 rounded-full" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">Sena</h1>
            <div className="flex-grow" />
            <button 
                onClick={() => setIsMenuOpen(prev => !prev)}
                className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                aria-label="Menu"
            >
                <Bars3Icon className="w-6 h-6 text-gray-600" />
            </button>
            {isMenuOpen && (
                <div 
                    className="absolute top-full right-4 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200/80 z-20 text-sm overflow-hidden"
                >
                   <ul className="divide-y divide-gray-100">
                        <li className="p-2">
                            <button onClick={() => setIsTtsEnabled(!isTtsEnabled)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left text-gray-700">
                                {isTtsEnabled ? <SpeakerWaveIcon className="w-5 h-5" /> : <SpeakerXMarkIcon className="w-5 h-5" />}
                                <span>Voz (TTS)</span>
                                <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${isTtsEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {isTtsEnabled ? 'ON' : 'OFF'}
                                </span>
                            </button>
                        </li>
                        <li className="p-2 space-y-1">
                            <div className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Funcionalidades</div>
                             <button onClick={() => handleSuggestionClick("Como funciona a análise de imagem?")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left text-gray-700">
                                <PaperClipIcon className="w-5 h-5" /> Analisar Imagem
                            </button>
                            <button onClick={() => handleSuggestionClick("Como funciona a criação de imagem?")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left text-gray-700">
                                <SparklesIcon className="w-5 h-5" /> Criar Imagem
                            </button>
                             <button onClick={() => handleSuggestionClick("Como você pode me ajudar com programação?")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left text-gray-700">
                                <CodeBracketIcon className="w-5 h-5" /> Assistente de Código
                            </button>
                        </li>
                         <li className="p-2 space-y-1">
                            <a href="mailto:sac.studiotsukiyo@outlook.com" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left text-gray-700">
                                <BugAntIcon className="w-5 h-5" /> Reportar um Bug
                            </a>
                            <button onClick={() => {
                                if (confirm('Tem certeza de que deseja iniciar um novo chat? Seu histórico atual será perdido.')) {
                                    resetChat();
                                    setAppState('welcome');
                                }
                            }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left text-gray-700">
                                <RestartIcon className="w-5 h-5" /> Iniciar Novo Chat
                            </button>
                        </li>
                   </ul>
                </div>
            )}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, index) => {
            const prevMsg = messages[index - 1];
            const showAvatar = msg.sender === 'bot' && (!prevMsg || prevMsg.sender !== 'bot');
            return <ChatMessage 
              key={msg.id} 
              message={msg} 
              showAvatar={showAvatar} 
              onPlayAudio={handlePlayAudio}
              playingMessageId={playingMessageId}
              isAudioLoading={isAudioLoading}
            />;
          })}
          {isTyping && (
             <div className="flex items-start gap-3">
                <div className="w-8 flex-shrink-0"><img src="https://i.imgur.com/iVFhqIl.png" alt="Sena Avatar" className="w-full h-full object-cover rounded-full" /></div>
                <div className="p-3 px-4 bg-gray-200/60 rounded-lg shadow-sm">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-0"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></span>
                    </div>
                </div>
             </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-200/50 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="space-y-3">
               {attachedFile && conversationStep === 'done' && (
                  <div className="p-2 bg-gray-100 rounded-lg flex items-center gap-2 text-sm animate-fade-in">
                      <img src={`data:${attachedFile.mimeType};base64,${attachedFile.data}`} alt="Preview" className="w-10 h-10 rounded object-cover" />
                      <span className="flex-1 truncate text-gray-700">{attachedFile.name}</span>
                      <button onClick={removeAttachedFile} className="p-1 rounded-full hover:bg-gray-300">
                          <XCircleIcon className="w-5 h-5 text-gray-500" />
                      </button>
                  </div>
                )}
              <form onSubmit={handleFormSubmit} className="flex items-end gap-2 bg-white rounded-xl p-2 border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 shadow-sm">
                {conversationStep === 'done' && (
                  <>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    <button type="button" onClick={handleFileSelect} className="p-2 rounded-full hover:bg-gray-200 transition-colors flex-shrink-0" aria-label="Anexar arquivo">
                        <PaperClipIcon className="w-5 h-5 text-gray-600" />
                    </button>
                  </>
                )}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={getInputPlaceholder()}
                  className="flex-1 bg-transparent px-2 text-sm text-gray-800 outline-none resize-none max-h-40"
                  disabled={isTyping}
                />
                <button type="submit" className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed" disabled={isTyping || (!inputValue.trim() && !attachedFile)}>
                  <SendIcon className="w-4 h-4" />
                </button>
              </form>
              {conversationStep === 'name' && (
                <button onClick={() => handleNameSubmit('')} className="w-full text-indigo-700 font-medium py-2 px-4 rounded-full bg-indigo-50 hover:bg-indigo-100 transition-colors text-sm">
                    Prefiro não dizer
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 border-t border-gray-200/50 flex-shrink-0">
            <p className="font-semibold">AmplaAI <span className="font-normal text-gray-400">v1.1.0</span></p>
            <p className="mt-1">A Sena pode cometer erros. Considere verificar informações importantes.</p>
        </div>
      </div>
    );
  };
  
  const renderCurrentScreen = () => {
    switch (appState) {
      case 'welcome':
        return renderWelcomeScreen();
      case 'about':
        return renderAboutScreen();
      case 'terms':
        return renderTermsScreen();
      case 'chat':
        return renderChatScreen();
      default:
        return renderWelcomeScreen();
    }
  };

  return (
    <main className="w-full h-screen bg-gradient-to-b from-slate-100 to-blue-200 flex items-center justify-center">
        <div className="w-full max-w-sm h-full max-h-[850px] bg-slate-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col mx-auto border-4 border-gray-800 sm:h-[calc(100%-4rem)] sm:max-h-[900px] sm:w-[450px]">
          {renderCurrentScreen()}
        </div>
    </main>
  );
}
