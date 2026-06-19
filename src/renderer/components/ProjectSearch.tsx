import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';

interface Hit { filePath: string; relativePath: string; lineNum: number; line: string; }

interface Props { onClose: () => void; }

export function ProjectSearch({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const rootPath = useProjectStore((s) => s.rootPath);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query.trim() || !rootPath) { setHits([]); return; }
    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const results = await window.aiIDE.search.inFiles(rootPath, query.trim());
        setHits(results);
      } finally {
        setSearching(false);
      }
    }, 250);
  }, [query, rootPath]);

  // Grupowanie po pliku
  const grouped: Record<string, Hit[]> = {};
  for (const h of hits) {
    (grouped[h.relativePath] ||= []).push(h);
  }

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk-panel" style={{ width: 640, maxHeight: '70vh' }} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Szukaj w plikach projektu..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        />
        <div className="cmdk-list">
          {searching && <div className="px-4 py-3 text-[11px] text-neutral-500">Szukam...</div>}
          {!searching && query && hits.length === 0 && (
            <div className="px-4 py-6 text-center text-[11px] text-neutral-500">Brak wyników</div>
          )}
          {Object.entries(grouped).map(([file, fileHits]) => (
            <div key={file} className="mb-1">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-neutral-500">
                {file} <span className="text-neutral-700">({fileHits.length})</span>
              </div>
              {fileHits.slice(0, 8).map((h, i) => (
                <div
                  key={i}
                  className="cmdk-item"
                  onClick={() => { setActiveFile(h.filePath); onClose(); }}
                >
                  <span className="w-8 shrink-0 font-mono text-[10px] text-neutral-600">{h.lineNum}</span>
                  <span className="truncate font-mono text-[11px] text-neutral-300">{h.line}</span>
                </div>
              ))}
              {fileHits.length > 8 && (
                <div className="px-3 py-1 text-[10px] text-neutral-600">+{fileHits.length - 8} więcej w tym pliku</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
