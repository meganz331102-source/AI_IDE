import { useEffect, useState } from 'react';
import { CodeEditor } from './CodeEditor/CodeEditor';
import { PreviewPanel } from './PreviewPanel/PreviewPanel';
import { Terminal } from './Terminal/Terminal';

type Tab = 'code' | 'preview';

const LS_TERMINAL_OPEN = 'aiide.terminal.open';
const LS_TERMINAL_HEIGHT = 'aiide.terminal.height';

export function MiddlePanel() {
  const [tab, setTab] = useState<Tab>('code');
  const [terminalOpen, setTerminalOpen] = useState(() => localStorage.getItem(LS_TERMINAL_OPEN) === '1');
  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem(LS_TERMINAL_HEIGHT));
    return saved >= 100 ? saved : 240;
  });

  // Skrót ⌘` przełącza terminal
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

  // Drag-resize terminala
  const startDrag = (e: React.MouseEvent) => {
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

  return (
    <div className="grid h-full min-h-0 bg-[#0c0c10]" style={{
      gridTemplateRows: terminalOpen ? `auto minmax(0,1fr) 4px ${terminalHeight}px` : 'auto minmax(0,1fr)'
    }}>
      <div className="flex items-center justify-between gap-0.5 border-b border-white/[0.06] bg-[#0a0a0c] px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <TabButton active={tab === 'code'} onClick={() => setTab('code')}>Kod</TabButton>
          <TabButton active={tab === 'preview'} onClick={() => setTab('preview')}>Podgląd</TabButton>
        </div>
        <button
          onClick={() => {
            const next = !terminalOpen;
            setTerminalOpen(next);
            localStorage.setItem(LS_TERMINAL_OPEN, next ? '1' : '0');
          }}
          title="Terminal (⌘`)"
          className={`rounded-md px-2 py-1 text-[10.5px] font-medium transition ${
            terminalOpen ? 'bg-white/[0.08] text-neutral-100' : 'text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300'
          }`}
        >
          ⌘` Terminal
        </button>
      </div>

      <div className="min-h-0">
        {tab === 'code' ? <CodeEditor /> : <PreviewPanel />}
      </div>

      {terminalOpen && (
        <>
          <div onMouseDown={startDrag} className="splitter cursor-row-resize" style={{ cursor: 'row-resize' }} />
          <div className="min-h-0">
            <Terminal />
          </div>
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-[11px] font-medium transition ${
        active
          ? 'bg-white/[0.08] text-neutral-100'
          : 'text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300'
      }`}
    >
      {children}
    </button>
  );
}
