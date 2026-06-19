import { DiffEditor } from '@monaco-editor/react';
import type { ProposedChange } from '../../../shared/types';

interface DiffViewerProps {
  change: ProposedChange;
  onAccept: (change: ProposedChange) => void;
  onReject: (change: ProposedChange) => void;
}

const TYPE_LABEL: Record<ProposedChange['type'], string> = {
  create: 'Nowy plik',
  modify: 'Modyfikacja',
  delete: 'Usunięcie',
};

export function DiffViewer({ change, onAccept, onReject }: DiffViewerProps) {
  return (
    <div className="flex flex-col rounded-lg border border-neutral-700 bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-700 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
            {TYPE_LABEL[change.type]}
          </span>
          <span className="text-sm text-neutral-200">{change.filePath}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onReject(change)}
            className="rounded px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            Odrzuć
          </button>
          <button
            onClick={() => onAccept(change)}
            className="rounded bg-emerald-700 px-3 py-1 text-xs text-white hover:bg-[#38a3a5]"
          >
            Zaakceptuj
          </button>
        </div>
      </div>
      <div style={{ height: 280 }}>
        <DiffEditor
          theme="vs-dark"
          original={change.originalContent ?? ''}
          modified={change.newContent ?? ''}
          options={{
            readOnly: true,
            fontSize: 12,
            renderSideBySide: true,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
}
