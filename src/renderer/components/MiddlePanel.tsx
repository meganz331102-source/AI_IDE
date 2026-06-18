import { useEffect, useState } from 'react';
import { CodeEditor } from './CodeEditor/CodeEditor';
import { PreviewPanel } from './PreviewPanel/PreviewPanel';
import { Terminal } from './Terminal/Terminal';

type Tab = 'code' | 'preview' | 'split';

const LS_TERMINAL_OPEN = 'aiide.terminal.open';
const LS_TERMINAL_HEIGHT = 'aiide.terminal.height';
const LS_SPLIT_RATIO = 'aiide.middle.splitRatio';
const LS_TAB = 'aiide.middle.tab';

export function MiddlePanel() {
  const [tab, setTab] = useState<Tab>(() => {
    const saved = localStorage.getItem(LS_TAB);
    return (saved === 'preview' || saved === 'split') ? saved : 'code';
  });
  const [terminalOpen, setTerminalOpen] = useState(() => localStorage.getItem(LS_TERMINAL_OPEN) === '1');
  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem(LS_TERMINAL_HEIGHT));
    return saved >= 100 ? saved : 240;
  });
  // Procent szerokości kodu w trybie Split (50% = pół-na-pół)
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    const n = Number(localStorage.getItem(LS_SPLIT_RATIO));
    return n >= 20 && n <= 80 ? n : 55;
  });

  // Skrót ⌘` = terminal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        setTerminalOpen((v) => {
          localStorage.setItem(LS_TERMINAL_OPEN, !v ? '1' : '0');
          return !v;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { localStorage.setItem(LS_TERMINAL_HEIGHT, String(terminalHeight)); }, [terminalHeight]);
  useEffect(() => { localStorage.setItem(LS_SPLIT_RATIO, String(splitRatio)); }, [splitRatio]);
  useEffect(() => { localStorage.setItem(LS_TAB, tab); }, [tab]);

  // Drag terminala
  const startDragTerminal = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = terminalHeight;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(100, Math.min(600, startH - (ev.clientY - startY)));
      setTerminalHeight(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Drag splittera pionowego (kod ⟷ podgląd)
  const startDragSplit = (e: React.MouseEvent) => {
    e.preventDefault();
    const containerW = (e.currentTarget as HTMLElement).parentElement!.clientWidth;
    const startX = e.clientX;
    const startRatio = splitRatio;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const pctDelta = (dx / containerW) * 100;
      const next = Math.max(20, Math.min(80, startRatio + pctDelta));
      setSplitRatio(next);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="grid h-full min-h-0 bg-[#0a1216]" style={{
      gridTemplateRows: terminalOpen ? `auto minmax(0,1fr) 4px ${terminalHeight}px` : 'auto minmax(0,1fr)'
    }}>
      <div className="flex items-center justify-between gap-0.5 border-b border-[#22577a]/25 bg-[#0d1820] px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <TabButton active={tab === 'code'} onClick={() => setTab('code')}>📝 Kod</TabButton>
          <TabButton active={tab === 'preview'} onClick={() => setTab('preview')}>👁 Podgląd</TabButton>
          <TabButton active={tab === 'split'} onClick={() => setTab('split')} title="Kod + Live Preview obok siebie">⫶ Split</TabButton>
        </div>
        <button
          onClick={() => {
            const next = !terminalOpen;
            setTerminalOpen(next);
            localStorage.setItem(LS_TERMINAL_OPEN, next ? '1' : '0');
          }}
          title="Terminal (⌘`)"
          className={`rounded-md px-2 py-1 text-[10.5px] font-medium transition ${
            terminalOpen ? 'bg-[#38a3a5]/25 text-[#c7f9cc]' : 'text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300'
          }`}
        >
          ⌘` Terminal
        </button>
      </div>

      <div className="min-h-0">
        {tab === 'code' && <CodeEditor />}
        {tab === 'preview' && <PreviewPanel />}
        {tab === 'split' && (
          <div
            className="grid h-full min-h-0"
            style={{ gridTemplateColumns: `${splitRatio}% 4px 1fr` }}
          >
            <div className="min-w-0 overflow-hidden"><CodeEditor /></div>
            <div onMouseDown={startDragSplit} className="splitter" title="Przeciągnij – zmień proporcje" />
            <div className="min-w-0 overflow-hidden"><PreviewPanel liveEditMode /></div>
          </div>
        )}
      </div>

      {terminalOpen && (
        <>
          <div onMouseDown={startDragTerminal} className="splitter cursor-row-resize" style={{ cursor: 'row-resize' }} />
          <div className="min-h-0">
            <Terminal />
          </div>
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-md px-3 py-1 text-[11px] font-medium transition ${
        active
          ? 'bg-[#38a3a5]/25 text-[#c7f9cc] ring-1 ring-[#38a3a5]/40'
          : 'text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300'
      }`}
    >
      {children}
    </button>
  );
}
