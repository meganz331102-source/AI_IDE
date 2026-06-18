import { useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useChatStore } from '../store/chatStore';
import { toast } from '../store/toastStore';
import type { ProjectFile } from '../../shared/types';

interface Command {
  id: string;
  label: string;
  kind: string;
  action: () => void;
}

function flattenFiles(nodes: ProjectFile[]): ProjectFile[] {
  const out: ProjectFile[] = [];
  function walk(ns: ProjectFile[]) {
    for (const n of ns) {
      if (!n.isDirectory) out.push(n);
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  return out;
}

interface Props {
  onClose: () => void;
  onOpenSettings: () => void;
}

export function CommandPalette({ onClose, onOpenSettings }: Props) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fileTree = useProjectStore((s) => s.fileTree);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const openProject = useProjectStore((s) => s.openProject);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const allFiles = useMemo(() => flattenFiles(fileTree), [fileTree]);

  const commands: Command[] = useMemo(() => [
    { id: 'open', label: 'Otwórz projekt...', kind: 'projekt', action: openProject },
    { id: 'settings', label: 'Ustawienia', kind: 'aplikacja', action: onOpenSettings },
    { id: 'newchat', label: 'Nowy czat (wyczyść)', kind: 'czat', action: () => { clearMessages(); toast.info('Nowy czat'); } },
  ], [openProject, onOpenSettings, clearMessages]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fileItems: Command[] = allFiles.map((f) => ({
      id: 'f:' + f.absolutePath,
      label: f.name,
      kind: f.path,
      action: () => setActiveFile(f.absolutePath),
    }));
    const all = [...commands, ...fileItems];
    if (!q) return all.slice(0, 50);
    return all
      .map((c) => ({ c, score: scoreMatch(c.label, q) + scoreMatch(c.kind, q) * 0.3 }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(({ c }) => c);
  }, [query, allFiles, commands, setActiveFile]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActiveIdx(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('.cmdk-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const it = items[activeIdx];
      if (it) { it.action(); onClose(); }
    }
  };

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk-panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Szukaj pliku lub komendy..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <div ref={listRef} className="cmdk-list">
          {items.length === 0 && (
            <div className="px-4 py-6 text-center text-[11px] text-neutral-500">Brak wyników</div>
          )}
          {items.map((it, idx) => (
            <div
              key={it.id}
              className={`cmdk-item ${idx === activeIdx ? 'active' : ''}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => { it.action(); onClose(); }}
            >
              <span>{it.label}</span>
              <span className="cmdk-item-kind">{it.kind}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function scoreMatch(text: string, query: string): number {
  const t = text.toLowerCase();
  if (!query) return 0;
  if (t === query) return 100;
  if (t.startsWith(query)) return 50;
  if (t.includes(query)) return 25;
  // fuzzy: wszystkie znaki query występują w kolejności
  let i = 0;
  for (const ch of t) { if (ch === query[i]) i++; if (i >= query.length) break; }
  return i === query.length ? 5 : 0;
}
