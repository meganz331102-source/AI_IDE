import { create } from 'zustand';

const LS = {
  showPrompt: 'aiide.settings.showFullPrompt',
  sysPrompt: 'aiide.settings.systemPrompt',
  autoApply: 'aiide.settings.autoApply',
  fontSize: 'aiide.settings.fontSize',
  snippets: 'aiide.settings.snippets',
  ollamaModel: 'aiide.settings.ollamaModel',
  autoUpdate: 'aiide.settings.autoUpdate',
};

export const DEFAULT_SYSTEM_PROMPT = [
  'Gdy proponujesz zmiany w kodzie, ZAWSZE używaj formatu:',
  '```język:ścieżka/do/pliku.ext',
  '(pełna nowa treść pliku)',
  '```',
  'Nigdy nie zapisuj plików samodzielnie – użytkownik zaakceptuje zmiany w interfejsie.',
].join('\n');

export interface Snippet { id: string; name: string; content: string; }

const DEFAULT_SNIPPETS: Snippet[] = [
  { id: 's1', name: 'Wyjaśnij ten kod', content: 'Wyjaśnij linijka po linijce co robi ten kod i dlaczego jest tak napisany.' },
  { id: 's2', name: 'Znajdź błędy', content: 'Przeanalizuj uważnie i wskaż potencjalne bugi, edge cases i problemy bezpieczeństwa.' },
  { id: 's3', name: 'Refactor', content: 'Zaproponuj refactor który poprawi czytelność i wydajność. Wyjaśnij każdą zmianę.' },
  { id: 's4', name: 'Dodaj testy', content: 'Napisz unit testy które pokrywają główne ścieżki i edge cases tego kodu.' },
  { id: 's5', name: 'Dodaj komentarze', content: 'Dodaj zwięzłe komentarze tłumaczące intencję kluczowych fragmentów (nie banalne "i++ inkrementuje").' },
];

interface SettingsState {
  showFullPrompt: boolean;
  systemPrompt: string;
  autoApply: boolean;
  fontSize: number;          // 12-18 px
  snippets: Snippet[];
  ollamaModel: string;       // wybrany model Ollamy, np. "llama3.1:8b"
  autoUpdate: boolean;       // sprawdzaj aktualizacje przy starcie
  setShowFullPrompt: (v: boolean) => void;
  setSystemPrompt: (v: string) => void;
  resetSystemPrompt: () => void;
  setAutoApply: (v: boolean) => void;
  setFontSize: (v: number) => void;
  addSnippet: (s: Omit<Snippet, 'id'>) => void;
  updateSnippet: (id: string, s: Partial<Snippet>) => void;
  deleteSnippet: (id: string) => void;
  setOllamaModel: (v: string) => void;
  setAutoUpdate: (v: boolean) => void;
}

function loadSnippets(): Snippet[] {
  try { return JSON.parse(localStorage.getItem(LS.snippets) || '') || DEFAULT_SNIPPETS; }
  catch { return DEFAULT_SNIPPETS; }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  showFullPrompt: localStorage.getItem(LS.showPrompt) === '1',
  systemPrompt: localStorage.getItem(LS.sysPrompt) ?? DEFAULT_SYSTEM_PROMPT,
  autoApply: localStorage.getItem(LS.autoApply) === '1',
  fontSize: Number(localStorage.getItem(LS.fontSize)) || 13,
  snippets: loadSnippets(),
  ollamaModel: localStorage.getItem(LS.ollamaModel) || 'llama3.1:8b',
  autoUpdate: localStorage.getItem(LS.autoUpdate) !== '0', // domyślnie WŁĄCZONE

  setShowFullPrompt: (v) => { localStorage.setItem(LS.showPrompt, v ? '1' : '0'); set({ showFullPrompt: v }); },
  setSystemPrompt: (v) => { localStorage.setItem(LS.sysPrompt, v); set({ systemPrompt: v }); },
  resetSystemPrompt: () => { localStorage.setItem(LS.sysPrompt, DEFAULT_SYSTEM_PROMPT); set({ systemPrompt: DEFAULT_SYSTEM_PROMPT }); },
  setAutoApply: (v) => { localStorage.setItem(LS.autoApply, v ? '1' : '0'); set({ autoApply: v }); },
  setFontSize: (v) => {
    const clamped = Math.max(11, Math.min(18, v));
    localStorage.setItem(LS.fontSize, String(clamped));
    set({ fontSize: clamped });
  },
  addSnippet: (s) => {
    const next = [...get().snippets, { ...s, id: crypto.randomUUID() }];
    localStorage.setItem(LS.snippets, JSON.stringify(next));
    set({ snippets: next });
  },
  updateSnippet: (id, partial) => {
    const next = get().snippets.map((s) => (s.id === id ? { ...s, ...partial } : s));
    localStorage.setItem(LS.snippets, JSON.stringify(next));
    set({ snippets: next });
  },
  deleteSnippet: (id) => {
    const next = get().snippets.filter((s) => s.id !== id);
    localStorage.setItem(LS.snippets, JSON.stringify(next));
    set({ snippets: next });
  },
  setOllamaModel: (v) => { localStorage.setItem(LS.ollamaModel, v); set({ ollamaModel: v }); },
  setAutoUpdate: (v) => { localStorage.setItem(LS.autoUpdate, v ? '1' : '0'); set({ autoUpdate: v }); },
}));

// Persystencja ustawień proxy
const LS_PROXY = 'aiide.privacy.proxyUrl';
const LS_PROXY_ON = 'aiide.privacy.proxyEnabled';

export function loadProxyConfig() {
  return {
    enabled: localStorage.getItem(LS_PROXY_ON) === '1',
    url: localStorage.getItem(LS_PROXY) || '',
  };
}
export function saveProxyConfig(enabled: boolean, url: string) {
  localStorage.setItem(LS_PROXY_ON, enabled ? '1' : '0');
  localStorage.setItem(LS_PROXY, url);
}
