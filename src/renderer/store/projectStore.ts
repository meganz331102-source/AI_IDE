import { create } from 'zustand';
import type { ProjectFile } from '../../shared/types';

const LS_RECENT = 'aiide.recentProjects';

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); }
  catch { return []; }
}
function saveRecent(list: string[]) {
  localStorage.setItem(LS_RECENT, JSON.stringify(list.slice(0, 8)));
}

interface ProjectState {
  rootPath: string | null;
  fileTree: ProjectFile[];
  selectedFilePaths: Set<string>;
  activeFilePath: string | null;
  recentProjects: string[];
  /** Bumpowany po każdym udanym zapisie pliku. Słuchany przez PreviewPanel w trybie Split → reload iframe. */
  fileSaveCounter: number;

  openProject: () => Promise<void>;
  loadProjectFromPath: (absPath: string) => Promise<void>;
  toggleFileSelection: (absolutePath: string) => void;
  setActiveFile: (absolutePath: string) => void;
  refreshTree: () => Promise<void>;
  removeRecent: (path: string) => void;
  /** Wywołane po pomyślnym zapisie pliku (CodeEditor, AI auto-apply). */
  bumpFileSaveCounter: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  rootPath: null,
  fileTree: [],
  selectedFilePaths: new Set(),
  activeFilePath: null,
  recentProjects: loadRecent(),
  fileSaveCounter: 0,

  openProject: async () => {
    const selectedPath = await window.aiIDE.fs.openProjectDialog();
    if (!selectedPath) return;
    const tree = await window.aiIDE.fs.readDirectory(selectedPath);
    const recent = [selectedPath, ...get().recentProjects.filter((p) => p !== selectedPath)];
    saveRecent(recent);
    set({ rootPath: selectedPath, fileTree: tree, selectedFilePaths: new Set(), recentProjects: recent });
  },

  loadProjectFromPath: async (absPath: string) => {
    const tree = await window.aiIDE.fs.readDirectory(absPath);
    const recent = [absPath, ...get().recentProjects.filter((p) => p !== absPath)];
    saveRecent(recent);
    set({ rootPath: absPath, fileTree: tree, selectedFilePaths: new Set(), activeFilePath: null, recentProjects: recent });
  },

  removeRecent: (path: string) => {
    const recent = get().recentProjects.filter((p) => p !== path);
    saveRecent(recent);
    set({ recentProjects: recent });
  },

  toggleFileSelection: (absolutePath: string) => {
    const current = new Set(get().selectedFilePaths);
    if (current.has(absolutePath)) {
      current.delete(absolutePath);
    } else {
      current.add(absolutePath);
    }
    set({ selectedFilePaths: current });
  },

  setActiveFile: (absolutePath: string) => {
    set({ activeFilePath: absolutePath });
  },

  refreshTree: async () => {
    const { rootPath } = get();
    if (!rootPath) return;
    const tree = await window.aiIDE.fs.readDirectory(rootPath);
    set({ fileTree: tree });
  },

  bumpFileSaveCounter: () => {
    set({ fileSaveCounter: get().fileSaveCounter + 1 });
  },
}));
