import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';

type Phase = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export function UpdatesTab() {
  const autoUpdate = useSettingsStore((s) => s.autoUpdate);
  const setAutoUpdate = useSettingsStore((s) => s.setAutoUpdate);

  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ percent: number; bps: number; transferred: number; total: number } | null>(null);

  useEffect(() => {
    window.aiIDE.updater.getCurrentVersion().then((v) => setCurrentVersion(v || ''));
    const offChecking = window.aiIDE.updater.on('checking', () => { setPhase('checking'); setError(null); });
    const offAvailable = window.aiIDE.updater.on('available', (p) => {
      setPhase('available');
      setNewVersion(p?.version || null);
      setReleaseNotes(typeof p?.releaseNotes === 'string' ? p.releaseNotes : '');
    });
    const offNotAvail = window.aiIDE.updater.on('not-available', () => setPhase('not-available'));
    const offProgress = window.aiIDE.updater.on('progress', (p) => {
      setPhase('downloading');
      setProgress({ percent: p.percent, bps: p.bytesPerSecond, transferred: p.transferred, total: p.total });
    });
    const offDownloaded = window.aiIDE.updater.on('downloaded', (p) => {
      setPhase('downloaded');
      setNewVersion(p?.version || newVersion);
    });
    const offError = window.aiIDE.updater.on('error', (p) => {
      setPhase('error');
      setError(p?.message || 'Nieznany błąd');
    });
    return () => { offChecking(); offAvailable(); offNotAvail(); offProgress(); offDownloaded(); offError(); };
  }, []);

  const handleCheck = async () => {
    setError(null);
    const r = await window.aiIDE.updater.check();
    if (!r.ok && r.error) {
      setPhase('error');
      setError(r.error);
    }
  };

  const handleDownload = async () => {
    const r = await window.aiIDE.updater.download();
    if (!r.ok && r.error) {
      setPhase('error');
      setError(r.error);
    }
  };

  const handleInstall = async () => {
    toast.info('Zamykam i instaluję aktualizację...');
    await window.aiIDE.updater.install();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-medium text-neutral-200">AI IDE {currentVersion ? `v${currentVersion}` : ''}</div>
            <div className="mt-0.5 text-[10.5px] text-neutral-500">Aktualizacje pobierane bezpośrednio z GitHub Releases. Klikasz „Sprawdź" i jeśli jest nowa wersja, pobierasz i instalujesz jednym kliknięciem.</div>
          </div>
          <button
            onClick={handleCheck}
            disabled={phase === 'checking' || phase === 'downloading'}
            className="shrink-0 rounded-md bg-[#38a3a5] px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-[#57cc99] disabled:opacity-40"
          >
            {phase === 'checking' ? 'Sprawdzam...' : 'Sprawdź teraz'}
          </button>
        </div>

        {phase === 'not-available' && (
          <div className="rounded-md bg-[#57cc99]/10 px-3 py-2 text-[11px] text-[#80ed99] ring-1 ring-[#57cc99]/40">
            ✓ Masz najnowszą wersję.
          </div>
        )}

        {phase === 'available' && newVersion && (
          <div className="space-y-2 rounded-md bg-[#57cc99]/10 p-3 ring-1 ring-[#38a3a5]/40">
            <div className="text-[12px] text-[#c7f9cc]">
              Dostępna nowa wersja: <span className="font-medium">v{newVersion}</span>
            </div>
            {releaseNotes && (
              <div className="max-h-32 overflow-y-auto rounded bg-black/30 p-2 font-mono text-[10.5px] leading-relaxed text-neutral-300 whitespace-pre-wrap">
                {releaseNotes.slice(0, 2000)}
              </div>
            )}
            <button
              onClick={handleDownload}
              className="w-full rounded-md bg-[#38a3a5] px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-[#57cc99]"
            >
              Pobierz aktualizację
            </button>
          </div>
        )}

        {phase === 'downloading' && progress && (
          <div className="space-y-2 rounded-md bg-[#faa307]/10 p-3 ring-1 ring-[#faa307]/40">
            <div className="flex items-center justify-between text-[11px] text-[#ffba08]">
              <span>Pobieram v{newVersion}...</span>
              <span className="font-mono">{progress.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
              <div className="h-full bg-[#faa307] transition-all" style={{ width: `${progress.percent}%` }} />
            </div>
            <div className="text-[10px] text-[#ffba08]/70">
              {fmtMB(progress.transferred)} / {fmtMB(progress.total)} · {fmtMB(progress.bps)}/s
            </div>
          </div>
        )}

        {phase === 'downloaded' && (
          <div className="space-y-2 rounded-md bg-[#57cc99]/10 p-3 ring-1 ring-[#57cc99]/40">
            <div className="text-[12px] text-[#c7f9cc]">
              ✓ Pobrano v{newVersion}. Kliknij aby zainstalować i uruchomić aplikację ponownie.
            </div>
            <button
              onClick={handleInstall}
              className="w-full rounded-md bg-[#38a3a5] px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-[#57cc99]"
            >
              Zainstaluj i uruchom ponownie
            </button>
          </div>
        )}

        {phase === 'error' && error && (
          <div className="rounded-md bg-red-500/10 px-3 py-2 text-[11px] text-red-300 ring-1 ring-red-500/30">
            Błąd: {error}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white/[0.02] p-4 ring-1 ring-white/[0.04]">
        <label className="flex cursor-pointer items-start gap-3">
          <button
            type="button"
            onClick={() => setAutoUpdate(!autoUpdate)}
            className={`mt-0.5 h-4 w-7 shrink-0 rounded-full transition ${autoUpdate ? 'bg-[#38a3a5]' : 'bg-white/[0.08]'}`}
          >
            <span className={`block h-3 w-3 rounded-full bg-white shadow-sm transition ${autoUpdate ? 'ml-3' : 'ml-0.5'}`} />
          </button>
          <div>
            <div className="text-[12px] text-neutral-200">Sprawdzaj aktualizacje automatycznie przy starcie</div>
            <div className="mt-0.5 text-[10.5px] leading-relaxed text-neutral-500">
              Po uruchomieniu aplikacji sprawdzi w tle, czy jest nowa wersja. Pobieranie zawsze wymaga Twojego kliknięcia.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}

function fmtMB(bytes: number): string {
  if (!bytes) return '0 MB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
