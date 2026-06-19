import { useEffect, useRef, useState } from 'react';
import type { AIModelId } from '../../../shared/types';

interface ModelOption {
  id: string;
  label: string;
  desc: string;
  badge: 'free' | 'key' | 'local' | 'beta';
}

interface ModelGroup {
  provider: string;
  icon: string;
  models: ModelOption[];
}

const GROUPS: ModelGroup[] = [
  {
    provider: 'Pollinations',
    icon: '✦',
    models: [
      { id: 'pollinations',         label: 'GPT-4.1 mini',  desc: 'OpenAI-kompatybilny endpoint, default', badge: 'free' },
      { id: 'pollinations-mistral', label: 'Mistral',       desc: 'Otwarty model, dobre ogólne',         badge: 'free' },
      { id: 'pollinations-llama',   label: 'Llama',         desc: 'Meta Llama przez Pollinations',       badge: 'free' },
      { id: 'pollinations-deepseek',label: 'DeepSeek',      desc: 'Mocny w kodowaniu',                   badge: 'free' },
    ],
  },
  {
    provider: 'Groq · cloud',
    icon: '⚡',
    models: [
      { id: 'groq', label: 'Llama 3.3 70B',  desc: 'Najszybsze (500 tok/s), wymaga free key', badge: 'key' },
    ],
  },
  {
    provider: 'Ollama · lokalnie',
    icon: '◉',
    models: [
      { id: 'ollama', label: 'Twój wybrany model', desc: 'Lokalny, offline, bez kosztów', badge: 'local' },
    ],
  },
  {
    provider: 'Eksperymentalne',
    icon: '⚗',
    models: [
      { id: 'chatgpt', label: 'ChatGPT (Chromium)', desc: 'Sterowane okno przeglądarki, tryb gość',   badge: 'beta' },
      { id: 'duckai',  label: 'Duck.ai',            desc: 'DuckDuckGo chat (API się zmieniło)',       badge: 'beta' },
    ],
  },
];

const BADGE_COLORS: Record<ModelOption['badge'], string> = {
  free:  'bg-[#57cc99]/20 text-[#c7f9cc] ring-[#57cc99]/40',
  key:   'bg-[#faa307]/20 text-[#ffba08] ring-[#faa307]/40',
  local: 'bg-[#38a3a5]/25 text-[#c7f9cc] ring-[#38a3a5]/50',
  beta:  'bg-white/[0.08] text-neutral-400 ring-white/[0.12]',
};

const BADGE_LABEL: Record<ModelOption['badge'], string> = {
  free: 'FREE', key: 'KLUCZ', local: 'LOCAL', beta: 'BETA',
};

function findOption(id: string): ModelOption | undefined {
  for (const g of GROUPS) for (const m of g.models) if (m.id === id) return m;
  return undefined;
}

interface Props {
  activeModel: AIModelId;
  onSelect: (id: AIModelId) => void;
}

export function ModelPicker({ activeModel, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const current = findOption(activeModel) || { label: activeModel, desc: '', badge: 'free' as const, id: activeModel };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = GROUPS.map((g) => ({
    ...g,
    models: q ? g.models.filter((m) => m.label.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q)) : g.models,
  })).filter((g) => g.models.length > 0);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-left text-[11.5px] ring-1 ring-white/[0.06] transition hover:bg-white/[0.07] hover:ring-[#38a3a5]/40"
      >
        <span className="shrink-0 text-[12px] text-[#80ed99]">✦</span>
        <span className="min-w-0 flex-1 truncate font-medium text-neutral-100">{current.label}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ring-1 ${BADGE_COLORS[current.badge]}`}>
          {BADGE_LABEL[current.badge]}
        </span>
        <span className={`shrink-0 text-[9px] text-neutral-500 transition ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[420px] overflow-hidden rounded-xl bg-[#0d1820]/98 backdrop-blur ring-1 ring-white/10 shadow-2xl">
          <div className="border-b border-white/[0.06] p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj modelu..."
              className="w-full rounded-md bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] text-neutral-100 ring-1 ring-white/[0.06] placeholder-neutral-600 outline-none focus:ring-[#38a3a5]/50"
            />
          </div>
          <div className="max-h-[340px] overflow-y-auto scrollbar-thin p-1.5">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-[11px] text-neutral-500">Brak wyników</div>
            )}
            {filtered.map((g) => (
              <div key={g.provider} className="mb-2 last:mb-0">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[9.5px] uppercase tracking-wider text-neutral-500">
                  <span>{g.icon}</span>
                  <span>{g.provider}</span>
                </div>
                {g.models.map((m) => {
                  const active = activeModel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { onSelect(m.id as AIModelId); setOpen(false); setQuery(''); }}
                      className={`group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition ${
                        active ? 'bg-[#38a3a5]/20 ring-1 ring-[#38a3a5]/40' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-[#80ed99] shadow-[0_0_6px_rgba(128,237,153,0.7)]' : 'bg-neutral-700'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-[12px] font-medium ${active ? 'text-white' : 'text-neutral-200'}`}>{m.label}</span>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8.5px] font-medium ring-1 ${BADGE_COLORS[m.badge]}`}>
                            {BADGE_LABEL[m.badge]}
                          </span>
                        </div>
                        <div className="truncate text-[10px] text-neutral-500">{m.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
