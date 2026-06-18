import { useEffect, useRef, useState } from 'react';
import { FileExplorer } from './components/FileExplorer/FileExplorer';
import { MiddlePanel } from './components/MiddlePanel';
import { AIChatPanel } from './components/AIChatPanel/AIChatPanel';
import { Settings } from './components/Settings/Settings';
import { CommandPalette } from './components/CommandPalette';
import { Welcome } from './components/Welcome';
import { StatusBar } from './components/StatusBar';
import { ToastContainer } from './components/ToastContainer';
import { OpenRepoModal } from './components/OpenRepoModal';
import { useProjectStore } from './store/projectStore';
import { useChatStore } from './store/chatStore';
import { toast } from './store/toastStore';

const LS_LEFT = 'aiide.panel.left';
const LS_RIGHT = 'aiide.panel.right';

export function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showOpenRepo, setShowOpenRepo] = useState(false);

  const openProject = useProjectStore((s) => s.openProject);
  const rootPath = useProjectStore((s) => s.rootPath);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const activeModel = useChatStore((s) => s.activeModel);
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(LS_LEFT));
    return saved && saved >= 180 ? saved : 260;
  });
  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(LS_RIGHT));
    // MINIMUM 380px – pasek modeli + textarea + akcje wymagają tyle żeby się zmieścić.
    return saved && saved >= 380 ? saved : 440;
  });
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);

  // Migracja: jeśli localStorage trzyma starą szerokość < 380, podbij do 440.
  useEffect(() => {
    const saved = Number(localStorage.getItem(LS_RIGHT));
    if (saved && saved < 380) {
      localStorage.setItem(LS_RIGHT, '440');
      setRightWidth(440);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIX: jeśli localStorage przechowuje szerokości z większego ekranu, suma kolumn
  // przekracza okno → grid wycina trzecią kolumnę (chat) przez overflow-hidden.
  // Klampujemy widths do aktualnego viewportu.
  useEffect(() => {
    const clamp = () => {
      const w = window.innerWidth;
      const minMiddle = 280;
      const minLeft = 180;
      const minRight = 380;
      const splitters = 8;
      const available = w - splitters - minMiddle;
      // Najpierw kurczymy right, potem left.
      let l = leftWidth, r = rightWidth;
      if (l + r > available) {
        r = Math.max(minRight, Math.min(r, available - l));
        if (l + r > available) l = Math.max(minLeft, available - r);
      }
      if (l !== leftWidth) setLeftWidth(l);
      if (r !== rightWidth) setRightWidth(r);
    };
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [leftWidth, rightWidth]);

  useEffect(() => { localStorage.setItem(LS_LEFT, String(leftWidth)); }, [leftWidth]);
  useEffect(() => { localStorage.setItem(LS_RIGHT, String(rightWidth)); }, [rightWidth]);

  // Zastosuj zapisaną konfigurację proxy przy starcie (jeśli była włączona)
  useEffect(() => {
    try {
      const enabled = localStorage.getItem('aiide.privacy.proxyEnabled') === '1';
      const url = localStorage.getItem('aiide.privacy.proxyUrl') || '';
      if (enabled && url) window.aiIDE.privacy.setProxy(url);
    } catch { /* ignore */ }
  }, []);

  // Auto-check aktualizacji przy starcie (cicho, w tle).
  // Pobranie zawsze wymaga klika użytkownika w Ustawieniach → Aktualizacje.
  useEffect(() => {
    if (localStorage.getItem('aiide.settings.autoUpdate') === '0') return;
    // mała pauza żeby nie blokować pierwszego renderu
    const t = setTimeout(() => {
      window.aiIDE.updater?.check?.().catch(() => { /* offline = ignore */ });
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  // Skróty klawiszowe globalne
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key === 'k') { e.preventDefault(); setShowPalette(true); }
      else if (cmd && e.key === ',') { e.preventDefault(); setShowSettings(true); }
      else if (cmd && e.key === 'o') { e.preventDefault(); openProject(); }
      else if (cmd && e.key === 'n') {
        e.preventDefault();
        clearMessages();
        window.aiIDE.ai.resetSession(activeModel);
        toast.info('Nowy czat');
      }
      else if (e.key === 'Escape' && showPalette) { setShowPalette(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPalette, openProject, clearMessages, activeModel]);

  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = (side: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(side);
    const startX = e.clientX;
    const startLeft = leftWidth;
    const startRight = rightWidth;
    const onMove = (ev: MouseEvent) => {
      const containerW = containerRef.current?.clientWidth ?? window.innerWidth;
      if (side === 'left') {
        const next = Math.max(200, Math.min(500, startLeft + (ev.clientX - startX)));
        if (containerW - next - rightWidth - 8 >= 380) setLeftWidth(next);
      } else {
        const next = Math.max(380, Math.min(900, startRight - (ev.clientX - startX)));
        if (containerW - leftWidth - next - 8 >= 380) setRightWidth(next);
      }
    };
    const onUp = () => {
      setDragging(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0a0a0c] text-neutral-100">
      <div
        className="flex shrink-0 items-center justify-between border-b border-white/[0.06] py-2.5 pr-3"
        style={{ paddingLeft: 88, WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* LEWA: logo + projekt + akcje projektu */}
        <div className="flex min-w-0 items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="h-2 w-2 shrink-0 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
          <span className="text-[13px] font-medium tracking-tight text-neutral-200" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>AI IDE</span>
          {rootPath && (
            <>
              <span className="text-neutral-700" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>/</span>
              <span className="min-w-0 truncate text-[11px] text-neutral-500" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
                {rootPath.split('/').slice(-2).join('/')}
              </span>
            </>
          )}
          <div className="mx-2 h-4 w-px bg-white/[0.06]" />
          <button
            onClick={openProject}
            title="Otwórz folder z dysku (⌘O)"
            className="rounded-md px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-white/[0.05] hover:text-white"
          >
            📁 Folder
          </button>
          <button
            onClick={() => setShowOpenRepo(true)}
            title="Otwórz repo z GitHuba"
            className="rounded-md px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-white/[0.05] hover:text-white"
          >
            ⎇ Repo
          </button>
        </div>

        {/* PRAWA: paleta + ustawienia (Clear/IP są teraz przy inpucie czatu) */}
        <div className="flex shrink-0 items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => setShowPalette(true)}
            title="Paleta komend (⌘K)"
            className="rounded-md px-2 py-1.5 text-[11px] text-neutral-500 hover:bg-white/[0.05] hover:text-neutral-200"
          >
            ⌘K
          </button>
          <button
            onClick={() => setShowSettings(true)}
            title="Ustawienia (⌘,)"
            aria-label="Ustawienia"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.04] text-neutral-300 ring-1 ring-white/[0.08] transition hover:bg-white/[0.10] hover:text-white hover:ring-white/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {!rootPath ? (
        <div className="flex-1">
          <Welcome
            onOpenRepo={() => setShowOpenRepo(true)}
            onOpenSettings={() => setShowSettings(true)}
          />
        </div>
      ) : (
        <div
          ref={containerRef}
          className="grid flex-1 overflow-hidden"
          style={{ gridTemplateColumns: `${leftWidth}px 4px 1fr 4px ${rightWidth}px` }}
        >
          <FileExplorer />
          <div onMouseDown={startDrag('left')} className={`splitter ${dragging === 'left' ? 'active' : ''}`} />
          <MiddlePanel />
          <div onMouseDown={startDrag('right')} className={`splitter ${dragging === 'right' ? 'active' : ''}`} />
          <AIChatPanel onOpenSettings={() => setShowSettings(true)} />
        </div>
      )}

      <StatusBar />

      {showOpenRepo && <OpenRepoModal onClose={() => setShowOpenRepo(false)} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showPalette && (
        <CommandPalette
          onClose={() => setShowPalette(false)}
          onOpenSettings={() => { setShowPalette(false); setShowSettings(true); }}
        />
      )}
      <ToastContainer />
    </div>
  );
}
