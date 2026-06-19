import { create } from 'zustand';

// Pomost między PreviewPanel (gdzie użytkownik klika element) a AIChatPanel
// (gdzie wiadomość ląduje w polu inputu).
interface DraftState {
  prefillNonce: number;        // żeby kolejne prefille triggerowały efekt
  prefillText: string;
  setPrefill: (text: string) => void;
  consume: () => string;
}

export const useDraftStore = create<DraftState>((set, get) => ({
  prefillNonce: 0,
  prefillText: '',
  setPrefill: (text) =>
    set((s) => ({ prefillText: text, prefillNonce: s.prefillNonce + 1 })),
  consume: () => {
    const t = get().prefillText;
    set({ prefillText: '' });
    return t;
  },
}));
