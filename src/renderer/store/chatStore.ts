import { create } from 'zustand';
import type { AIModelId, ChatMessage, SessionStatus } from '../../shared/types';

const LS_MESSAGES = 'aiide.chat.messages';
const LS_MODEL = 'aiide.chat.activeModel';

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LS_MESSAGES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-100) : []; // keep last 100
  } catch { return []; }
}

function saveMessages(msgs: ChatMessage[]) {
  try { localStorage.setItem(LS_MESSAGES, JSON.stringify(msgs.slice(-100))); }
  catch { /* quota? – ignore */ }
}

interface ChatState {
  activeModel: AIModelId;
  messages: ChatMessage[];
  sessionStatus: Record<AIModelId, SessionStatus | undefined>;
  isSending: boolean;

  setActiveModel: (modelId: AIModelId) => void;
  clearMessages: () => void;
  removeLastExchange: () => void;
  startSession: (modelId: AIModelId) => Promise<void>;
  sendMessage: (visibleContent: string, fullPrompt: string, attachedFiles: string[]) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeModel: (localStorage.getItem(LS_MODEL) as AIModelId) || 'pollinations',
  messages: loadMessages(),
  sessionStatus: {} as Record<AIModelId, SessionStatus | undefined>,
  isSending: false,

  setActiveModel: (modelId) => {
    localStorage.setItem(LS_MODEL, modelId);
    set({ activeModel: modelId });
  },

  clearMessages: () => {
    saveMessages([]);
    set({ messages: [] });
  },

  // Usuń ostatnią wiadomość użytkownika + odpowiedź AI (dla "edytuj i wyślij ponownie")
  removeLastExchange: () => {
    const msgs = [...get().messages];
    // zdejmij od końca dopóki nie usuniemy ostatniego user-message
    while (msgs.length > 0) {
      const last = msgs.pop()!;
      if (last.role === 'user') break;
    }
    saveMessages(msgs);
    set({ messages: msgs });
  },

  startSession: async (modelId) => {
    const status = await window.aiIDE.ai.startSession(modelId);
    set((state) => ({ sessionStatus: { ...state.sessionStatus, [modelId]: status } }));
  },

  sendMessage: async (visibleContent, fullPrompt, attachedFiles) => {
    const { activeModel } = get();

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: visibleContent,
      modelId: activeModel,
      timestamp: Date.now(),
      attachedFiles,
    };

    const msgsWithUser = [...get().messages, userMessage];
    saveMessages(msgsWithUser);
    set({ messages: msgsWithUser, isSending: true });

    try {
      const responseText = await window.aiIDE.ai.sendMessage(activeModel, fullPrompt);
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseText,
        modelId: activeModel,
        timestamp: Date.now(),
      };
      const next = [...get().messages, assistantMessage];
      saveMessages(next);
      set({ messages: next, isSending: false });
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Błąd: ${error instanceof Error ? error.message : String(error)}`,
        modelId: activeModel,
        timestamp: Date.now(),
      };
      const next = [...get().messages, errorMessage];
      saveMessages(next);
      set({ messages: next, isSending: false });
    }
  },
}));
