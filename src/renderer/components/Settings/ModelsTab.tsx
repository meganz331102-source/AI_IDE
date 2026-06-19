import { useEffect, useState } from 'react';
import { toast } from '../../store/toastStore';
import { useSettingsStore } from '../../store/settingsStore';
import { OLLAMA_MODELS, OllamaModelOption } from '../../../shared/constants';

export function ModelsTab() {
  const [groqKey, setGroqKey] = useState('');
  const [hasGroq, setHasGroq] = useState(false);

  // Ollama state
  const [ollamaReady, setOllamaReady] = useState<boolean | null>(null); // null = sprawdzam
  const [installedModels, setInstalledModels] = useState<Set<string>>(new Set());
  const [pulling, setPulling] = useState<Record<string, { percent: number; status: string }>>({});
  const ollamaModel = useSettingsStore((s) => s.ollamaModel);
  const setOllamaModel = useSettingsStore((s) => s.setOllamaModel);

  useEffect(() => {
    window.aiIDE.ai.hasKey('groq').then(setHasGroq);
    refreshOllama();
    const off = window.aiIDE.ollama.onPullProgress((p) => {
      setPulling((prev) => ({
        ...prev,
        [p.model]: { percent: p.percent ?? prev[p.model]?.percent ?? 0, status: p.status },
      }));
    });
    return () => { off(); };
  }, []);

  const refreshOllama = async () => {
    const ok = await window.aiIDE.ollama.ping();
    setOllamaReady(ok);
    if (ok) {
      const list = await window.aiIDE.ollama.list();
      setInstalledModels(new Set(list.map((m) => m.name)));
    } else {
      setInstalledModels(new Set());
    }
  };

  const saveGroq = async () => {
    if (!groqKey.trim()) return;
    await window.aiIDE.ai.setKey('groq', groqKey.trim());
    setGroqKey('');
    setHasGroq(true);
    toast.success('Klucz Groq zapisany');
  };

  const clearGroq = async () => {
    await window.aiIDE.ai.clearKey('groq');
    setHasGroq(false);
    toast.info('Klucz Groq usunięty');
  };

  const pullModel = async (model: string) => {
    setPulling((p) => ({ ...p, [model]: { percent: 0, status: 'startuję...' } }));
    const r = await window.aiIDE.ollama.pull(model);
    setPulling((p) => { const cp = { ...p }; delete cp[model]; return cp; });
    if (r.ok) {
      toast.success(`Pobrano ${model}`);
      await refreshOllama();
    } else {
      toast.error(`Błąd pobierania ${model}: ${r.error || 'nieznany'}`);
    }
  };

  const cancelPull = async (model: string) => {
    await window.aiIDE.ollama.cancelPull(model);
    setPulling((p) => { const cp = { ...p }; delete cp[model]; return cp; });
  };

  const deleteModel = async (model: string) => {
    if (!confirm(`Usunąć model ${model}? Zwolni miejsce na dysku.`)) return;
    const r = await window.aiIDE.ollama.delete(model);
    if (r.ok) {
      toast.info(`Usunięto ${model}`);
      await refreshOllama();
    } else {
      toast.error(`Błąd: ${r.error || 'nieznany'}`);
    }
  };

  return (
    <div className="space-y-5">
      <ModelCard
        name="GPT (Pollinations)"
        status="✓ Działa bez setupu"
        statusKind="ok"
        desc="Darmowy OpenAI-kompatybilny endpoint. Bez klucza, bez limitów. Domyślny model aplikacji."
        provider="pollinations.ai"
      />

      <ModelCard
        name="Mistral / Llama (Pollinations)"
        status="✓ Działa bez setupu"
        statusKind="ok"
        desc="Te same endpointy, alternatywne modele. Wybierz w pasku modeli na górze czatu."
      />

      {/* === OLLAMA (lokalnie, free) === */}
      <div className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-neutral-200">Ollama (lokalnie, free)</span>
            {ollamaReady === null && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-neutral-400">sprawdzam...</span>}
            {ollamaReady === true && <span className="rounded bg-[#57cc99]/15 px-1.5 py-0.5 text-[10px] text-[#80ed99]">✓ Działa</span>}
            {ollamaReady === false && <span className="rounded bg-[#faa307]/15 px-1.5 py-0.5 text-[10px] text-[#ffba08]">Nie znaleziono</span>}
          </div>
          <button
            onClick={refreshOllama}
            title="Odśwież stan"
            className="rounded-md px-2 py-1 text-[11px] text-neutral-400 ring-1 ring-white/[0.06] hover:bg-white/[0.06] hover:text-neutral-200"
          >
            ↻
          </button>
        </div>
        <p className="mb-3 text-[10.5px] leading-relaxed text-neutral-500">
          Modele AI uruchamiane na Twoim Macu — bez wysyłania danych na zewnątrz, bez klucza, bez limitów. Wybierz rozmiar, pobierz raz, używaj zawsze. Rekomendowane modele oznaczone ⭐.
        </p>

        {ollamaReady === false && (
          <div className="mb-3 rounded-md bg-[#faa307]/10 p-3 ring-1 ring-[#faa307]/40">
            <div className="mb-2 text-[11px] text-[#ffba08]">
              Ollama nie jest zainstalowana lub nie działa. Zainstaluj raz — potem aplikacja sama łączy się z lokalnym serwerem.
            </div>
            <button
              onClick={() => window.aiIDE.shell.openExternal('https://ollama.com/download')}
              className="w-full rounded-md bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-900 hover:bg-neutral-100"
            >
              Otwórz ollama.com/download
            </button>
          </div>
        )}

        {ollamaReady === true && (
          <>
            <div className="mb-2 text-[10.5px] text-neutral-400">Aktywny model (klik w pasku modeli na górze czatu):</div>
            <select
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="mb-3 w-full rounded-md bg-white/[0.04] px-3 py-1.5 text-[12px] text-neutral-100 ring-1 ring-white/[0.08] outline-none focus:ring-[#38a3a5]/50"
            >
              {OLLAMA_MODELS.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.label}{m.recommended ? ' ⭐' : ''}{installedModels.has(m.name) ? ' · zainstalowany' : ''}
                </option>
              ))}
            </select>

            <div className="space-y-1.5">
              {OLLAMA_MODELS.map((m) => (
                <OllamaModelRow
                  key={m.name}
                  model={m}
                  installed={installedModels.has(m.name)}
                  pulling={pulling[m.name]}
                  isActive={ollamaModel === m.name}
                  onPull={() => pullModel(m.name)}
                  onCancel={() => cancelPull(m.name)}
                  onDelete={() => deleteModel(m.name)}
                  onActivate={() => setOllamaModel(m.name)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* === GROQ === */}
      <div className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[13px] font-medium text-neutral-200">Groq (Llama 3.3 70B)</span>
          {hasGroq
            ? <span className="rounded bg-[#57cc99]/15 px-1.5 py-0.5 text-[10px] text-[#80ed99]">✓ Klucz zapisany</span>
            : <span className="rounded bg-[#faa307]/15 px-1.5 py-0.5 text-[10px] text-[#ffba08]">Wymaga klucza</span>}
        </div>
        <p className="mb-3 text-[10.5px] leading-relaxed text-neutral-500">
          Najszybszy darmowy LLM (do 500 tok/s). Wymaga DARMOWEGO klucza z console.groq.com – wystarczy email, nie podajesz karty.
        </p>
        {hasGroq ? (
          <button onClick={clearGroq} className="rounded-md bg-white/[0.04] px-3 py-1.5 text-[11px] text-neutral-300 ring-1 ring-white/[0.06] hover:bg-white/[0.07]">
            Usuń klucz
          </button>
        ) : (
          <>
            <button
              onClick={() => window.aiIDE.shell.openExternal('https://console.groq.com/keys')}
              className="mb-2 w-full rounded-md bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-900 hover:bg-neutral-100"
            >
              Otwórz console.groq.com i wygeneruj klucz
            </button>
            <input
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              type="password"
              placeholder="gsk_..."
              className="mb-2 w-full rounded-md bg-white/[0.04] px-3 py-1.5 text-[12px] text-neutral-100 ring-1 ring-white/[0.08] outline-none focus:ring-[#38a3a5]/50"
            />
            <button
              onClick={saveGroq}
              disabled={!groqKey.trim()}
              className="w-full rounded-md bg-[#38a3a5] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#57cc99] disabled:opacity-40"
            >
              Zapisz klucz
            </button>
          </>
        )}
      </div>

      <ModelCard
        name="Duck.ai"
        status="⚠ Eksperymentalne — API zmienione"
        statusKind="warn"
        desc="DuckDuckGo wprowadził anty-bot challenge (x-vqd-hash-1) który wymaga rozwiązania JS-em. Może zadziałać sporadycznie. Polecam Pollinations zamiast."
      />

      <div className="rounded-xl bg-white/[0.02] p-4 ring-1 ring-white/[0.04]">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[13px] font-medium text-neutral-200">ChatGPT (przez Chromium)</span>
          <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-300">Widoczne okno</span>
        </div>
        <p className="text-[10.5px] leading-relaxed text-neutral-500">
          Otwiera widoczne okno Chromium w trybie incognito, auto-klika odrzucenie cookies i „Stay logged out", potem zadaje pytanie. Jeśli wyskoczy Cloudflare/CAPTCHA — rozwiążesz raz w widocznym oknie. Działa bez logowania (tryb gościa, limit kilkunastu wiadomości).
        </p>
        <button
          onClick={async () => { await window.aiIDE.ai.closeBrowser(); toast.info('Okno Chromium zamknięte – następne pytanie otworzy świeżą sesję'); }}
          className="mt-3 rounded-md bg-white/[0.04] px-3 py-1.5 text-[11px] text-neutral-300 ring-1 ring-white/[0.06] hover:bg-white/[0.07]"
        >
          Zamknij okno (świeży incognito przy następnym pytaniu)
        </button>
      </div>
    </div>
  );
}

function OllamaModelRow({
  model, installed, pulling, isActive, onPull, onCancel, onDelete, onActivate,
}: {
  model: OllamaModelOption;
  installed: boolean;
  pulling?: { percent: number; status: string };
  isActive: boolean;
  onPull: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onActivate: () => void;
}) {
  return (
    <div className={`rounded-lg p-2.5 ring-1 transition ${isActive ? 'bg-[#57cc99]/10 ring-[#38a3a5]/40' : 'bg-white/[0.02] ring-white/[0.04]'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-medium text-neutral-100">{model.label}</span>
            {model.recommended === 'code'    && <span className="rounded bg-[#faa307]/20 px-1.5 py-0.5 text-[9px] font-medium text-[#ffba08]">⭐ REKOMENDOWANY DO KODU</span>}
            {model.recommended === 'general' && <span className="rounded bg-[#57cc99]/20 px-1.5 py-0.5 text-[9px] font-medium text-[#c7f9cc]">⭐ REKOMENDOWANY</span>}
            {installed && <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[9px] text-neutral-300">zainstalowany</span>}
          </div>
          <div className="mt-0.5 text-[10.5px] text-neutral-500">{model.desc}</div>
          <div className="mt-1 text-[9.5px] text-neutral-600">
            {model.sizeGB} GB do pobrania · min. {model.ramGB} GB RAM · <span className="font-mono">{model.name}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {pulling ? (
            <>
              <div className="w-28 text-right text-[10px] text-[#ffba08]">
                {pulling.percent ?? 0}% · {pulling.status?.slice(0, 14) || ''}
              </div>
              <div className="h-1 w-28 overflow-hidden rounded-full bg-black/30">
                <div className="h-full bg-[#faa307] transition-all" style={{ width: `${pulling.percent || 0}%` }} />
              </div>
              <button onClick={onCancel} className="rounded bg-white/[0.04] px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-white/[0.08]">
                Anuluj
              </button>
            </>
          ) : installed ? (
            <>
              <button
                onClick={onActivate}
                disabled={isActive}
                className={`rounded px-2 py-1 text-[10.5px] font-medium ${isActive ? 'bg-[#38a3a5]/30 text-[#c7f9cc]' : 'bg-[#38a3a5] text-white hover:bg-[#57cc99]'}`}
              >
                {isActive ? '✓ Aktywny' : 'Użyj'}
              </button>
              <button onClick={onDelete} className="rounded bg-white/[0.04] px-2 py-1 text-[10px] text-red-300 hover:bg-white/[0.08]">
                Usuń
              </button>
            </>
          ) : (
            <button onClick={onPull} className="rounded bg-[#38a3a5] px-2 py-1 text-[10.5px] font-medium text-white hover:bg-[#57cc99]">
              Pobierz
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelCard({ name, status, statusKind, desc, provider }:
  { name: string; status: string; statusKind: 'ok' | 'warn' | 'err'; desc: string; provider?: string }) {
  const colors = {
    ok: 'bg-[#57cc99]/15 text-[#80ed99]',
    warn: 'bg-[#faa307]/15 text-[#ffba08]',
    err: 'bg-red-500/15 text-red-300',
  };
  return (
    <div className="rounded-xl bg-white/[0.02] p-4 ring-1 ring-white/[0.04]">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[13px] font-medium text-neutral-200">{name}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${colors[statusKind]}`}>{status}</span>
      </div>
      <p className="text-[10.5px] leading-relaxed text-neutral-500">{desc}</p>
      {provider && <div className="mt-1 text-[10px] text-neutral-600">via {provider}</div>}
    </div>
  );
}
