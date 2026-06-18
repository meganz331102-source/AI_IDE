import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { toast } from '../../store/toastStore';

const SESSION_ID = 'main';
const LS_HISTORY = 'aiide.terminal.history';

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'); }
  catch { return []; }
}
function saveHistory(h: string[]) {
  localStorage.setItem(LS_HISTORY, JSON.stringify(h.slice(-100)));
}

interface OutputChunk {
  data: string;
  kind: 'stdout' | 'stderr' | 'cmd' | 'system';
}

export function Terminal() {
  const rootPath = useProjectStore((s) => s.rootPath);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<OutputChunk[]>([
    { data: 'AI IDE terminal (zsh -ilc). Wpisz polecenie i Enter.\n', kind: 'system' },
  ]);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>(loadHistory());
  const [historyIdx, setHistoryIdx] = useState(-1);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const offOut = window.aiIDE.terminal.onOutput(({ sessionId, data, kind }) => {
      if (sessionId !== SESSION_ID) return;
      setOutput((prev) => [...prev, { data, kind }]);
    });
    const offExit = window.aiIDE.terminal.onExit(({ sessionId, code, signal }) => {
      if (sessionId !== SESSION_ID) return;
      setOutput((prev) => [...prev, {
        data: `\n[exit code ${code}${signal ? ' signal ' + signal : ''}]\n`,
        kind: 'system'
      }]);
      setRunning(false);
    });
    return () => { offOut(); offExit(); };
  }, []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const run = async () => {
    if (!input.trim() || !rootPath) return;
    const cmd = input;
    setOutput((prev) => [...prev, { data: `$ ${cmd}\n`, kind: 'cmd' }]);
    const newHistory = [...history.filter((h) => h !== cmd), cmd];
    setHistory(newHistory);
    saveHistory(newHistory);
    setHistoryIdx(-1);
    setInput('');
    setRunning(true);
    await window.aiIDE.terminal.run(SESSION_ID, cmd, rootPath);
  };

  const kill = async () => {
    await window.aiIDE.terminal.kill(SESSION_ID);
    toast.info('Polecenie przerwane');
  };

  const clearOutput = () => {
    setOutput([{ data: 'Wyczyszczono.\n', kind: 'system' }]);
  };

  if (!rootPath) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0c] text-[12px] text-neutral-500">
        Otwórz projekt, by używać terminala
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0c]">
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-1.5">
        <div className="flex items-center gap-2 text-[10.5px] text-neutral-500">
          <span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'}`} />
          <span className="font-mono">{rootPath.split('/').slice(-2).join('/')}</span>
          <span className="text-neutral-700">·</span>
          <span>{running ? 'wykonuję...' : 'gotowy'}</span>
        </div>
        <div className="flex items-center gap-1">
          {running && (
            <button onClick={kill} className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/25">
              ◼ Przerwij
            </button>
          )}
          <button onClick={clearOutput} className="rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200" title="Wyczyść (⌘L)">
            ⌫
          </button>
        </div>
      </div>

      <div
        ref={outputRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-snug"
      >
        {output.map((chunk, i) => (
          <span
            key={i}
            className={
              chunk.kind === 'cmd' ? 'text-indigo-300' :
              chunk.kind === 'stderr' ? 'text-red-300' :
              chunk.kind === 'system' ? 'text-neutral-500 italic' :
              'text-neutral-200'
            }
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {chunk.data}
          </span>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-3 py-2">
        <span className="font-mono text-[12px] text-emerald-400">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); run(); }
            else if (e.key === 'ArrowUp' && history.length > 0) {
              e.preventDefault();
              const newIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
              setHistoryIdx(newIdx);
              setInput(history[newIdx]);
            }
            else if (e.key === 'ArrowDown' && historyIdx !== -1) {
              e.preventDefault();
              const newIdx = historyIdx + 1;
              if (newIdx >= history.length) {
                setHistoryIdx(-1);
                setInput('');
              } else {
                setHistoryIdx(newIdx);
                setInput(history[newIdx]);
              }
            }
            else if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
              e.preventDefault();
              clearOutput();
            }
            else if ((e.metaKey || e.ctrlKey) && e.key === 'c' && running) {
              e.preventDefault();
              kill();
            }
          }}
          placeholder={running ? 'wykonuję poprzednie polecenie...' : 'npm install, git status, ls -la …'}
          disabled={running}
          className="w-full bg-transparent font-mono text-[12px] text-neutral-100 placeholder-neutral-600 outline-none disabled:opacity-50"
        />
      </div>
    </div>
  );
}
