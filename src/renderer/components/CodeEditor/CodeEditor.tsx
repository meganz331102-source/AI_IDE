import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useProjectStore } from '../../store/projectStore';

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    yml: 'yaml',
    yaml: 'yaml',
  };
  return map[ext] ?? 'plaintext';
}

export function CodeEditor() {
  const activeFilePath = useProjectStore((s) => s.activeFilePath);
  const [content, setContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!activeFilePath) return;
    window.aiIDE.fs.readFileContent(activeFilePath).then((text) => {
      setContent(text);
      setIsDirty(false);
    });
  }, [activeFilePath]);

  const handleSave = async () => {
    if (!activeFilePath) return;
    await window.aiIDE.fs.writeFileContent(activeFilePath, content);
    setIsDirty(false);
  };

  if (!activeFilePath) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0c0c10] text-neutral-600">
        <div className="mb-2 text-3xl text-neutral-700">⌘</div>
        <div className="text-[12px]">Wybierz plik z eksploratora, aby go edytować</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0c0c10]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
        <span className="text-[12px] text-neutral-300">
          {activeFilePath.split('/').pop()}
          {isDirty && <span className="ml-1.5 text-amber-400">●</span>}
        </span>
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="rounded-md bg-white/[0.04] px-2.5 py-1 text-[11px] text-neutral-200 ring-1 ring-white/[0.06] transition hover:bg-white/[0.07] disabled:opacity-40"
        >
          Zapisz (⌘S)
        </button>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          language={getLanguageFromPath(activeFilePath)}
          value={content}
          onChange={(value) => {
            setContent(value ?? '');
            setIsDirty(true);
          }}
          options={{
            fontSize: 13,
            minimap: { enabled: true },
            wordWrap: 'on',
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
