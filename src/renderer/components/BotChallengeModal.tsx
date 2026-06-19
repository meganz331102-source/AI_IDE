import { useEffect, useState } from 'react';

interface Props {
  kind: 'rate' | 'challenge' | 'chatgpt-visible';
  retryAfter?: number;
  url?: string;
  message: string;
  onClose: () => void;
  onRetry: () => void;
}

export function BotChallengeModal({ kind, retryAfter, url, message, onClose, onRetry }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(retryAfter || 0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass w-[460px] rounded-2xl p-6 ring-1 ring-white/10 shadow-2xl">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#faa307]/15 ring-1 ring-amber-500/40">
            <span className="text-lg">⚠</span>
          </div>
          <h3 className="text-sm font-medium text-neutral-100">
            {kind === 'rate' ? 'Limit zapytań' :
             kind === 'chatgpt-visible' ? 'ChatGPT wymaga rozwiązania challenge' :
             'Potwierdź że nie jesteś botem'}
          </h3>
        </div>
        <p className="mb-4 text-[12px] leading-relaxed text-neutral-300">{message}</p>

        {kind === 'rate' && secondsLeft > 0 && (
          <div className="mb-4 rounded-lg bg-[#faa307]/10 px-3 py-2 text-center text-[12px] text-[#ffba08] ring-1 ring-[#faa307]/40">
            Możesz spróbować ponownie za <span className="font-mono font-medium">{secondsLeft}s</span>
          </div>
        )}

        {kind === 'challenge' && url && (
          <button
            onClick={() => window.aiIDE.shell.openExternal(url)}
            className="mb-2 w-full rounded-lg bg-white px-3 py-2.5 text-[12px] font-medium text-neutral-900 transition hover:bg-neutral-100"
          >
            Otwórz Duck.ai w przeglądarce
          </button>
        )}

        {kind === 'chatgpt-visible' && (
          <button
            onClick={async () => {
              await window.aiIDE.ai.openChatGPTVisible();
            }}
            className="mb-2 w-full rounded-lg bg-white px-3 py-2.5 text-[12px] font-medium text-neutral-900 transition hover:bg-neutral-100"
          >
            Pokaż okno Chromium (rozwiąż challenge)
          </button>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-[12px] text-neutral-300 ring-1 ring-white/[0.06] hover:bg-white/[0.08]"
          >
            Anuluj
          </button>
          <button
            onClick={onRetry}
            disabled={kind === 'rate' && secondsLeft > 0}
            className="flex-1 rounded-lg bg-[#38a3a5] px-3 py-2 text-[12px] font-medium text-white hover:bg-[#57cc99] disabled:opacity-40"
          >
            {kind === 'rate' && secondsLeft > 0 ? `Czekaj ${secondsLeft}s` : 'Spróbuj ponownie'}
          </button>
        </div>
      </div>
    </div>
  );
}
