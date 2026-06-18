import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useDraftStore } from '../../store/draftStore';
import { toast } from '../../store/toastStore';

interface PickedElement {
  selector: string;
  outerHTML: string;
  text: string;
  tagName: string;
}

interface DevServerStatus {
  running: boolean;
  url?: string | null;
  framework?: string;
}

export function PreviewPanel() {
  const rootPath = useProjectStore((s) => s.rootPath);
  const setPrefill = useDraftStore((s) => s.setPrefill);

  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<PickedElement | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [addressInput, setAddressInput] = useState('');
  const [htmlFiles, setHtmlFiles] = useState<string[]>([]);
  const [needsPick, setNeedsPick] = useState(false);
  const [isExternal, setIsExternal] = useState(false);

  // Dev server
  const [detectedFramework, setDetectedFramework] = useState<string | null>(null);
  const [depsInstalled, setDepsInstalled] = useState<boolean>(true);
  const [devStatus, setDevStatus] = useState<DevServerStatus>({ running: false });
  const [devStarting, setDevStarting] = useState(false);
  const [showDevLog, setShowDevLog] = useState(false);
  const [devLog, setDevLog] = useState<string>('');

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Cache: ostatnio użyty URL per rootPath – nie znika z iframe podczas re-detect.
  const lastUrlByRoot = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!rootPath) { setUrl(null); return; }
    setError(null);
    setNeedsPick(false);
    setPicked(null);
    setDevLog('');

    // Jeśli mamy cache dla tego rootPath – pokaż od razu, równolegle re-detect.
    const cached = lastUrlByRoot.current.get(rootPath);
    if (cached) {
      setUrl(cached);
      setAddressInput(cached.startsWith('http://127.0.0.1') ? new URL(cached).pathname : cached);
    }

    // Parallel: status, detect, preview.start.
    // Wcześniej szły sekwencyjnie (3 awaitsy) – łącznie 200-800ms na nic.
    (async () => {
      const [statusResult, detResult, startResult] = await Promise.allSettled([
        window.aiIDE.devServer.status(),
        window.aiIDE.devServer.detect(rootPath),
        window.aiIDE.preview.start(rootPath),
      ]);

      const status: DevServerStatus = statusResult.status === 'fulfilled' ? statusResult.value : { running: false };
      const det = detResult.status === 'fulfilled' ? detResult.value : null;
      const startData = startResult.status === 'fulfilled' ? startResult.value : null;

      setDevStatus(status);
      setDetectedFramework(det?.framework || null);
      setDepsInstalled(det?.installed ?? true);

      // Priorytet 1: aktywny dev server
      if (status.running && status.url) {
        setUrl(status.url);
        setBaseUrl(status.url);
        setAddressInput(status.url);
        setIsExternal(true);
        lastUrlByRoot.current.set(rootPath, status.url);
        return;
      }

      // Priorytet 2: statyczny serwer + znaleziony index.html
      if (startData) {
        setBaseUrl(startData.url);
        if (startData.indexPath) {
          const full = startData.url.replace(/\/$/, '') + '/' + startData.indexPath.replace(/^\//, '');
          setUrl(full);
          setIsExternal(false);
          setAddressInput('/' + startData.indexPath);
          lastUrlByRoot.current.set(rootPath, full);
          return;
        }
      }

      // Priorytet 3: lista .html do wyboru
      try {
        const list = await window.aiIDE.preview.listHtml(rootPath);
        setHtmlFiles(list);
        setNeedsPick(true);
        if (!cached) setUrl(null);
        setAddressInput('/');
      } catch (e) {
        setError(String((e as any)?.message || e));
      }
    })().catch((e) => setError(String(e?.message || e)));
  }, [rootPath]);

  // Subskrypcje dev server eventów
  useEffect(() => {
    const offLog = window.aiIDE.devServer.onLog((line) => {
      setDevLog((prev) => (prev + line).slice(-8000));
    });
    const offReady = window.aiIDE.devServer.onReady(({ url: devUrl, framework }) => {
      setDevStatus({ running: true, url: devUrl, framework });
      setUrl(devUrl);
      setAddressInput(devUrl);
      setIsExternal(true);
      setNeedsPick(false);
      setDevStarting(false);
      toast.success(`${framework} dev server: ${devUrl}`);
    });
    const offExit = window.aiIDE.devServer.onExit(() => {
      setDevStatus({ running: false });
      setDevStarting(false);
    });
    return () => { offLog(); offReady(); offExit(); };
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'AIIDE_ELEMENT_PICKED') {
        setPicked(e.data as PickedElement);
        setPicking(false);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const togglePicker = () => {
    if (isExternal) return;
    const next = !picking;
    setPicking(next);
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'AIIDE_PICKER_TOGGLE', active: next }, '*'
    );
  };

  const sendToChat = () => {
    if (!picked) return;
    const message =
      `Zmień ten element na stronie:\n` +
      `Selektor CSS: \`${picked.selector}\`\n` +
      (picked.text ? `Aktualna treść: ${JSON.stringify(picked.text)}\n` : '') +
      `HTML:\n\`\`\`html\n${picked.outerHTML}\n\`\`\`\n\n` +
      `Co ma zostać zmienione: `;
    setPrefill(message);
    setPicked(null);
  };

  const pickHtmlFile = (rel: string) => {
    if (!baseUrl) return;
    setUrl(baseUrl.replace(/\/$/, '') + '/' + rel.replace(/^\//, ''));
    setAddressInput('/' + rel);
    setNeedsPick(false);
    setIsExternal(false);
  };

  const navigateTo = (input: string) => {
    const v = input.trim();
    if (!v) return;
    if (/^https?:\/\//i.test(v)) {
      setUrl(v);
      setIsExternal(true);
      setNeedsPick(false);
    } else if (baseUrl && !devStatus.running) {
      const p = v.startsWith('/') ? v : '/' + v;
      setUrl(baseUrl.replace(/\/$/, '') + p);
      setIsExternal(false);
      setNeedsPick(false);
    } else if (devStatus.url) {
      const p = v.startsWith('/') ? v : '/' + v;
      setUrl(devStatus.url + p);
      setIsExternal(true);
      setNeedsPick(false);
    }
    setReloadKey((k) => k + 1);
  };

  const startDev = async () => {
    if (!rootPath) return;
    setDevStarting(true);
    setDevLog('');
    setError(null);
    const result = await window.aiIDE.devServer.start(rootPath);
    if (!result.ok) {
      setDevStarting(false);
      // Jeśli błąd "command not found" – pokaż diagnostykę
      let extraInfo = '';
      if (result.error?.includes('127') || result.error?.includes('npm')) {
        const diag = await window.aiIDE.devServer.diagnose();
        extraInfo = `\nDiagnostyka:\n• npm: ${diag.npm || 'NIE ZNALEZIONO'}\n• node: ${diag.node || 'NIE ZNALEZIONO'}\n• PATH: ${diag.path.slice(0, 200)}...`;
      }
      toast.error(`Dev server: ${result.error}${extraInfo}`);
      setError(`${result.error}${extraInfo}`);
      setShowDevLog(true);
    }
  };

  const stopDev = async () => {
    await window.aiIDE.devServer.stop();
    setDevStatus({ running: false });
    toast.info('Dev server zatrzymany');
  };

  const reload = () => setReloadKey((k) => k + 1);

  if (!rootPath) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0c0c10] text-neutral-600">
        <div className="mb-2 text-3xl text-neutral-700">⬚</div>
        <div className="text-[12px]">Otwórz projekt, by zobaczyć podgląd</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0c0c10]">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.06] px-3 py-2">
        <button
          onClick={togglePicker}
          disabled={isExternal || !url}
          title={isExternal ? 'Picker tylko dla statycznego podglądu (cross-origin nie pozwala)' : 'Kliknij element na stronie'}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
            picking
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white/[0.04] text-neutral-200 ring-1 ring-white/[0.06] hover:bg-white/[0.07]'
          } disabled:opacity-40`}
        >
          {picking ? '◉ Wybierz' : '◎ Zaznacz'}
        </button>
        <button onClick={reload} className="rounded-md px-2 py-1 text-[11px] text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200" title="Odśwież">↻</button>
        <input
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') navigateTo(addressInput); }}
          placeholder="/ albo http://localhost:3000"
          className="flex-1 rounded-md bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-neutral-200 ring-1 ring-white/[0.06] placeholder-neutral-600 outline-none focus:bg-white/[0.06] focus:ring-indigo-500/40"
        />
        <button
          onClick={() => navigateTo(addressInput)}
          className="rounded-md bg-indigo-600/90 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500"
        >Idź</button>
      </div>

      {/* Dev server pasek */}
      {(detectedFramework || devStatus.running || devStarting) && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-emerald-500/[0.04] px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2 text-[10.5px]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${devStatus.running ? 'bg-emerald-500' : devStarting ? 'animate-pulse bg-amber-500' : 'bg-neutral-600'}`} />
            <span className="text-neutral-300">
              {devStatus.running && devStatus.url
                ? <>Dev server: <span className="font-mono text-emerald-300">{devStatus.url}</span> ({devStatus.framework})</>
                : devStarting
                ? <>{depsInstalled ? `Uruchamiam ${detectedFramework}...` : `Instaluję zależności (npm install) + uruchamiam ${detectedFramework}...`} (30-90s)</>
                : <>Wykryto {detectedFramework}{!depsInstalled && <span className="text-amber-300"> · brak node_modules</span>}. Kliknij ▶ żeby {depsInstalled ? 'uruchomić' : 'zainstalować i uruchomić'}.</>}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setShowDevLog((v) => !v)}
              className="rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200"
            >
              {showDevLog ? 'Ukryj log' : 'Log'}
            </button>
            {devStatus.running ? (
              <button onClick={stopDev} className="rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/25">
                Stop
              </button>
            ) : (
              <button onClick={startDev} disabled={devStarting} className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40">
                {devStarting ? 'Startuję...' : '▶ Uruchom'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Log dev servera */}
      {showDevLog && (
        <div className="shrink-0 border-b border-white/[0.06] bg-black/40 p-2">
          <pre className="max-h-32 overflow-y-auto scrollbar-thin whitespace-pre-wrap font-mono text-[10px] leading-tight text-neutral-400">{devLog || '(brak logów)'}</pre>
        </div>
      )}

      {/* Zaznaczony element */}
      {picked && (
        <div className="shrink-0 border-b border-white/[0.06] bg-indigo-500/[0.06] px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10.5px] text-indigo-300">Zaznaczono: <span className="font-mono text-indigo-200">{picked.selector}</span></span>
            <button onClick={() => setPicked(null)} className="rounded-md px-1.5 py-0.5 text-[10px] text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200">Anuluj</button>
          </div>
          {picked.text && <div className="mb-1.5 truncate text-[10.5px] text-neutral-500">„{picked.text}"</div>}
          <button onClick={sendToChat} className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500">
            Wyślij do AI → opisz zmianę w czacie
          </button>
        </div>
      )}

      {/* Główna treść */}
      <div className="relative flex-1 min-h-0 bg-white">
        {error ? (
          <div className="flex h-full items-center justify-center bg-[#0c0c10] p-4 text-center text-[12px] text-red-400">
            Błąd: {error}
          </div>
        ) : needsPick ? (
          <div className="flex h-full flex-col items-center justify-start overflow-y-auto scrollbar-thin bg-[#0c0c10] p-6">
            <div className="mb-3 text-3xl text-neutral-700">▣</div>
            <div className="mb-1 text-center text-[12px] text-neutral-300">Nie znalazłem index.html w typowych miejscach</div>
            <div className="mb-4 max-w-md text-center text-[10.5px] text-neutral-500">
              Sprawdzałem: root, <code>public/</code>, <code>out/</code>, <code>dist/</code>, <code>build/</code>, <code>docs/</code>, <code>www/</code>.
            </div>
            {detectedFramework && !devStatus.running && (
              <button
                onClick={startDev}
                disabled={devStarting}
                className="mb-4 rounded-md bg-indigo-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                ▶ Uruchom dev server ({detectedFramework})
              </button>
            )}
            {htmlFiles.length === 0 ? (
              <div className="rounded-md bg-amber-500/10 px-3 py-2 text-center text-[11px] text-amber-200 ring-1 ring-amber-500/30">
                <div className="mb-1 font-medium">Brak plików .html w projekcie.</div>
                <div className="text-[10px] opacity-80">
                  {detectedFramework
                    ? `Wygląda na ${detectedFramework}. Kliknij przycisk powyżej żeby uruchomić dev server.`
                    : 'Nie wykryto frameworka. Wpisz URL u góry albo dodaj index.html.'}
                </div>
              </div>
            ) : (
              <>
                <div className="mb-2 text-[10.5px] text-neutral-500">lub wybierz plik:</div>
                <div className="max-h-72 w-full max-w-md space-y-1 overflow-y-auto scrollbar-thin">
                  {htmlFiles.map((rel) => (
                    <button key={rel} onClick={() => pickHtmlFile(rel)} className="w-full truncate rounded-md bg-white/[0.04] px-3 py-1.5 text-left text-[11.5px] font-mono text-neutral-200 ring-1 ring-white/[0.06] hover:bg-white/[0.07]">
                      {rel}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : url ? (
          <iframe
            key={reloadKey}
            ref={iframeRef}
            src={url}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title="Podgląd"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#0c0c10] text-[12px] text-neutral-500">Ładuję podgląd...</div>
        )}
      </div>
    </div>
  );
}
