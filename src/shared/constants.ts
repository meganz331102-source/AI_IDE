import { AIModelConfig } from './types';

// Modele dostępne w aplikacji.
// Pollinations = darmowe, bez klucza, default (najpewniejsze).
// Groq = darmowe ale wymaga darmowego klucza (najszybsze, najlepsze).
// Duck.ai = darmowe, bez klucza, ale ich API się zmieniło (eksperymentalne).

export const AI_MODELS: Record<string, AIModelConfig> = {
  pollinations: {
    id: 'pollinations',
    label: 'GPT (Pollinations)',
    url: 'https://text.pollinations.ai/',
    selectors: { promptInput: '', sendButton: '', responseContainer: '', loginIndicator: '' },
  },
  'pollinations-mistral': {
    id: 'pollinations-mistral',
    label: 'Mistral',
    url: 'https://text.pollinations.ai/',
    selectors: { promptInput: '', sendButton: '', responseContainer: '', loginIndicator: '' },
  },
  'pollinations-llama': {
    id: 'pollinations-llama',
    label: 'Llama',
    url: 'https://text.pollinations.ai/',
    selectors: { promptInput: '', sendButton: '', responseContainer: '', loginIndicator: '' },
  },
  groq: {
    id: 'groq',
    label: 'Groq (Llama 70B)',
    url: 'https://console.groq.com',
    selectors: { promptInput: '', sendButton: '', responseContainer: '', loginIndicator: '' },
  },
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT',
    url: 'https://chatgpt.com/',
    selectors: { promptInput: '', sendButton: '', responseContainer: '', loginIndicator: '' },
  },
  duckai: {
    id: 'duckai',
    label: 'Duck.ai',
    url: 'https://duckduckgo.com/?ia=chat',
    selectors: { promptInput: '', sendButton: '', responseContainer: '', loginIndicator: '' },
  },
};

export const DEFAULT_CONTEXT_BUDGET = {
  maxTokens: 8000,
  systemPromptTokens: 500,
  reserveForResponseTokens: 2000,
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
