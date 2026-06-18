import { useProjectStore } from '../store/projectStore';
import { useChatStore } from '../store/chatStore';
import { AI_MODELS } from '../../shared/constants';

export function StatusBar() {
  const rootPath = useProjectStore((s) => s.rootPath);
  const activeFile = useProjectStore((s) => s.activeFilePath);
  const selectedCount = useProjectStore((s) => s.selectedFilePaths.size);
  const activeModel = useChatStore((s) => s.activeModel);
  const isSending = useChatStore((s) => s.isSending);

  return (
    <div className="status-bar">
      <span className="inline-flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${isSending ? 'animate-pulse bg-[#faa307]' : 'bg-[#57cc99]'}`} />
        {isSending ? 'AI pracuje...' : 'Gotowe'}
      </span>
      <span className="sep">·</span>
      <span>{AI_MODELS[activeModel]?.label || activeModel}</span>
      {rootPath && (
        <>
          <span className="sep">·</span>
          <span className="truncate">{rootPath.split('/').slice(-2).join('/')}</span>
        </>
      )}
      {activeFile && (
        <>
          <span className="sep">·</span>
          <span className="truncate">{activeFile.split('/').pop()}</span>
        </>
      )}
      <div className="ml-auto flex items-center gap-3">
        {selectedCount > 0 && <span>{selectedCount} w kontekście</span>}
        <span className="text-neutral-700">⌘K paleta · ⌘` terminal · ⌘, ustawienia</span>
      </div>
    </div>
  );
}
