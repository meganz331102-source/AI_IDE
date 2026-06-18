import { useEffect, useState } from 'react';
import { toast } from '../../store/toastStore';

export function ModelsTab() {
  const [groqKey, setGroqKey] = useState('');
  const [hasGroq, setHasGroq] = useState(false);

  useEffect(() => {
    window.aiIDE.ai.hasKey('groq').then(setHasGroq);
  }, []);

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

      <div className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[13px] font-medium text-neutral-200">Groq (Llama 3.3 70B)</span>
          {hasGroq
            ? <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">✓ Klucz zapisany</span>
            : <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">Wymaga klucza</span>}
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
              className="mb-2 w-full rounded-md bg-white/[0.04] px-3 py-1.5 text-[12px] text-neutral-100 ring-1 ring-white/[0.08] outline-none focus:ring-indigo-500/40"
            />
            <button
              onClick={saveGroq}
              disabled={!groqKey.trim()}
              className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
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

function ModelCard({ name, status, statusKind, desc, provider }:
  { name: string; status: string; statusKind: 'ok' | 'warn' | 'err'; desc: string; provider?: string }) {
  const colors = {
    ok: 'bg-emerald-500/15 text-emerald-300',
    warn: 'bg-amber-500/15 text-amber-300',
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
