import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type { ProjectFile } from '../../../shared/types';

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: '◆', tsx: '◆', js: '●', jsx: '●', mjs: '●',
    html: '◐', css: '◑', scss: '◑', sass: '◑',
    json: '⊕', md: '✎', txt: '✎',
    py: '▲', rb: '▼', go: '◢', rs: '◣', java: '◤', php: '◥',
    sh: '$', yml: '⊳', yaml: '⊳', toml: '⊳', xml: '◐',
    png: '▣', jpg: '▣', jpeg: '▣', gif: '▣', svg: '▣', webp: '▣', ico: '▣',
    pdf: '▤',
  };
  return map[ext] || '·';
}

function FileNode({ node, depth }: { node: ProjectFile; depth: number }) {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const selectedFilePaths = useProjectStore((s) => s.selectedFilePaths);
  const toggleFileSelection = useProjectStore((s) => s.toggleFileSelection);
  const setActiveFile = useProjectStore((s) => s.setActiveFile);
  const activeFilePath = useProjectStore((s) => s.activeFilePath);

  const isSelected = selectedFilePaths.has(node.absolutePath);
  const isActive = activeFilePath === node.absolutePath;

  if (node.isDirectory) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-[12px] text-neutral-300 transition hover:bg-white/[0.04]"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <span className="text-neutral-600">{isOpen ? '▾' : '▸'}</span>
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen && node.children && (
          <div>
            {node.children.map((child) => (
              <FileNode key={child.absolutePath} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1 text-[12px] transition hover:bg-white/[0.04] ${
        isActive ? 'bg-white/[0.06] text-white' : 'text-neutral-300'
      }`}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => toggleFileSelection(node.absolutePath)}
        className="h-3 w-3 accent-[#38a3a5]"
        title="Dodaj plik do kontekstu AI"
      />
      <span className="w-3 shrink-0 text-center text-[10px] text-neutral-600">{fileIcon(node.name)}</span>
      <button onClick={() => setActiveFile(node.absolutePath)} className="flex-1 truncate text-left">
        {node.name}
      </button>
    </div>
  );
}

export function FileExplorer() {
  const fileTree = useProjectStore((s) => s.fileTree);
  const rootPath = useProjectStore((s) => s.rootPath);
  const openProject = useProjectStore((s) => s.openProject);
  const selectedFilePaths = useProjectStore((s) => s.selectedFilePaths);
  const [search, setSearch] = useState('');

  const filteredTree = search
    ? filterTree(fileTree, search.toLowerCase())
    : fileTree;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a1216]">
      <div className="shrink-0 border-b border-[#22577a]/25 p-3">
        <button
          onClick={openProject}
          className="w-full truncate rounded-lg bg-[#22577a]/20 px-3 py-1.5 text-[12px] text-[#c7f9cc] ring-1 ring-[#38a3a5]/30 transition hover:bg-[#22577a]/35 hover:ring-[#57cc99]/50"
          title={rootPath || 'Otwórz projekt'}
        >
          {rootPath ? '📁 ' + rootPath.split('/').pop() : 'Otwórz projekt...'}
        </button>
      </div>

      {rootPath && (
        <div className="shrink-0 border-b border-[#22577a]/25 p-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj plików..."
            className="w-full rounded-md bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-neutral-200 ring-1 ring-white/[0.06] placeholder-neutral-600 outline-none transition focus:bg-white/[0.06] focus:ring-[#38a3a5]/50"
          />
        </div>
      )}

      {/* Drzewo plików – własny scroll (scrollbar-thin w palecie teal) */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin py-2">
        {filteredTree.length === 0 && rootPath && (
          <div className="px-4 py-6 text-center text-[11px] text-neutral-600">
            {search ? 'Brak plików pasujących do wyszukiwania' : 'Brak plików w projekcie'}
          </div>
        )}
        {filteredTree.map((node) => (
          <FileNode key={node.absolutePath} node={node} depth={0} />
        ))}
      </div>

      <div className="shrink-0 border-t border-[#22577a]/25 px-3 py-2 text-[10.5px] text-[#9ec5c6]">
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${selectedFilePaths.size > 0 ? 'bg-[#57cc99] shadow-[0_0_6px_rgba(128,237,153,0.6)]' : 'bg-neutral-700'}`} />
          {selectedFilePaths.size} {selectedFilePaths.size === 1 ? 'plik' : 'plików'} w kontekście AI
        </span>
      </div>
    </div>
  );
}

function filterTree(nodes: ProjectFile[], query: string): ProjectFile[] {
  const result: ProjectFile[] = [];
  for (const node of nodes) {
    if (node.isDirectory && node.children) {
      const filteredChildren = filterTree(node.children, query);
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    } else if (node.name.toLowerCase().includes(query)) {
      result.push(node);
    }
  }
  return result;
}
