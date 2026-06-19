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
  ollama: {
    id: 'ollama',
    label: 'Ollama (lokalnie)',
    url: 'http://127.0.0.1:11434',
    selectors: { promptInput: '', sendButton: '', responseContainer: '', loginIndicator: '' },
  },
  duckai: {
    id: 'duckai',
    label: 'Duck.ai',
    url: 'https://duckduckgo.com/?ia=chat',
    selectors: { promptInput: '', sendButton: '', responseContainer: '', loginIndicator: '' },
  },
};

// Katalog rekomendowanych modeli Ollamy z rozmiarami.
// Użytkownik może pobrać dowolny — gwiazdki przy najlepszych.
export interface OllamaModelOption {
  name: string;        // pełna nazwa Ollama: "llama3.1:8b"
  label: string;       // przyjazna: "Llama 3.1 8B"
  sizeGB: number;      // przybliżony rozmiar pobrania
  ramGB: number;       // minimalny RAM do działania
  recommended?: 'general' | 'code' | null;
  desc: string;
}

export const OLLAMA_MODELS: OllamaModelOption[] = [
  { name: 'gemma2:2b',          label: 'Gemma 2 · 2B',           sizeGB: 1.6,  ramGB: 4,   desc: 'Najmniejszy. Działa nawet na słabym Macu, ale jakość ograniczona.' },
  { name: 'phi3:mini',          label: 'Phi-3 Mini · 3.8B',      sizeGB: 2.3,  ramGB: 6,   desc: 'Lekki, szybki, sensowna jakość do prostych pytań.' },
  { name: 'mistral:7b',         label: 'Mistral · 7B',           sizeGB: 4.1,  ramGB: 8,   desc: 'Solidny ogólny model, działa płynnie na 8 GB RAM.' },
  { name: 'qwen2.5-coder:7b',   label: 'Qwen 2.5 Coder · 7B',    sizeGB: 4.7,  ramGB: 8,   recommended: 'code',    desc: 'REKOMENDOWANY do kodu. Specjalizowany w programowaniu, świetna jakość vs rozmiar.' },
  { name: 'llama3.1:8b',        label: 'Llama 3.1 · 8B',         sizeGB: 4.7,  ramGB: 8,   recommended: 'general', desc: 'REKOMENDOWANY ogólny. Najlepszy stosunek jakości do wymagań na typowym Macu.' },
  { name: 'qwen2.5-coder:14b',  label: 'Qwen 2.5 Coder · 14B',   sizeGB: 9,    ramGB: 16,  desc: 'Mocniejszy Coder. Wymaga 16 GB RAM.' },
  { name: 'qwen2.5-coder:32b',  label: 'Qwen 2.5 Coder · 32B',   sizeGB: 19,   ramGB: 32,  desc: 'Topowy lokalny model do kodu. Tylko M-Series Pro/Max z dużym RAM.' },
  { name: 'llama3.1:70b',       label: 'Llama 3.1 · 70B',        sizeGB: 40,   ramGB: 64,  desc: 'Najwyższa jakość, ale wymaga 64+ GB RAM (M-Series Max/Ultra).' },
];

export const DEFAULT_OLLAMA_MODEL = 'llama3.1:8b';

export const DEFAULT_CONTEXT_BUDGET = {
  maxTokens: 8000,
  systemPromptTokens: 500,
  reserveForResponseTokens: 2000,
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
