import { contextBridge, ipcRenderer } from 'electron';
import type {
  AIModelId,
  ProjectFile,
  SelectedContextFile,
  ProposedChange,
  SessionStatus,
} from '../src/shared/types';

// Jedyny punkt komunikacji renderer -> main. Renderer NIE ma dostępu
// do Node.js / fs / child_process – wszystko przechodzi przez te wywołania.
contextBridge.exposeInMainWorld('aiIDE', {
  fs: {
    openProjectDialog: (): Promise<string | null> =>
      ipcRenderer.invoke('fs:openProjectDialog'),
    readDirectory: (rootPath: string): Promise<ProjectFile[]> =>
      ipcRenderer.invoke('fs:readDirectory', rootPath),
    readFileContent: (absolutePath: string): Promise<string> =>
      ipcRenderer.invoke('fs:readFileContent', absolutePath),
    writeFileContent: (absolutePath: string, content: string): Promise<void> =>
      ipcRenderer.invoke('fs:writeFileContent', absolutePath, content),
    deleteFile: (absolutePath: string): Promise<void> =>
      ipcRenderer.invoke('fs:deleteFile', absolutePath),
  },

  git: {
    status: (repoPath: string) => ipcRenderer.invoke('git:status', repoPath),
    commit: (repoPath: string, message: string) =>
      ipcRenderer.invoke('git:commit', repoPath, message),
    createBranch: (repoPath: string, branchName: string) =>
      ipcRenderer.invoke('git:createBranch', repoPath, branchName),
    createPullRequest: (
      owner: string,
      repo: string,
      head: string,
      base: string,
      title: string,
      body: string
    ) => ipcRenderer.invoke('git:createPullRequest', owner, repo, head, base, title, body),
    listRepos: () => ipcRenderer.invoke('git:listRepos'),
    getUser: () => ipcRenderer.invoke('git:getUser'),
    cloneRepo: (cloneUrl: string) => ipcRenderer.invoke('git:cloneRepo', cloneUrl),
  },

  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },

  ai: {
    startSession: (modelId: AIModelId): Promise<SessionStatus> =>
      ipcRenderer.invoke('ai:startSession', modelId),
    sendMessage: (modelId: AIModelId, prompt: string): Promise<string> =>
      ipcRenderer.invoke('ai:sendMessage', modelId, prompt),
    getSessionStatus: (modelId: AIModelId): Promise<SessionStatus> =>
      ipcRenderer.invoke('ai:getSessionStatus', modelId),
    showLoginWindow: (modelId: AIModelId): Promise<void> =>
      ipcRenderer.invoke('ai:showLoginWindow', modelId),
    abort: (modelId: AIModelId): Promise<void> =>
      ipcRenderer.invoke('ai:abort', modelId),
    resetSession: (modelId: AIModelId): Promise<void> =>
      ipcRenderer.invoke('ai:resetSession', modelId),
    setKey: (provider: string, key: string): Promise<void> =>
      ipcRenderer.invoke('ai:setKey', provider, key),
    hasKey: (provider: string): Promise<boolean> =>
      ipcRenderer.invoke('ai:hasKey', provider),
    clearKey: (provider: string): Promise<void> =>
      ipcRenderer.invoke('ai:clearKey', provider),
    closeBrowser: (): Promise<void> =>
      ipcRenderer.invoke('ai:closeBrowser'),
    isBrowserOpen: (): Promise<boolean> =>
      ipcRenderer.invoke('ai:isBrowserOpen'),
    openChatGPTVisible: (): Promise<boolean> =>
      ipcRenderer.invoke('ai:openChatGPTVisible'),
  },

  context: {
    buildContext: (filePaths: string[]): Promise<SelectedContextFile[]> =>
      ipcRenderer.invoke('context:build', filePaths),
    rankRelevantFiles: (rootPath: string, query: string): Promise<string[]> =>
      ipcRenderer.invoke('context:rank', rootPath, query),
  },

  changes: {
    applyChange: (change: ProposedChange): Promise<void> =>
      ipcRenderer.invoke('changes:apply', change),
  },

  keychain: {
    setGitHubToken: (token: string): Promise<void> =>
      ipcRenderer.invoke('keychain:setGitHubToken', token),
    hasGitHubToken: (): Promise<boolean> =>
      ipcRenderer.invoke('keychain:hasGitHubToken'),
    clearGitHubToken: (): Promise<void> =>
      ipcRenderer.invoke('keychain:clearGitHubToken'),
  },

  preview: {
    start: (rootPath: string): Promise<{ port: number; url: string }> =>
      ipcRenderer.invoke('preview:start', rootPath),
    setRoot: (rootPath: string): Promise<void> =>
      ipcRenderer.invoke('preview:setRoot', rootPath),
    stop: (): Promise<void> => ipcRenderer.invoke('preview:stop'),
    listHtml: (rootPath: string): Promise<string[]> =>
      ipcRenderer.invoke('preview:listHtml', rootPath),
  },

  search: {
    inFiles: (rootPath: string, query: string) =>
      ipcRenderer.invoke('search:inFiles', rootPath, query),
  },

  privacy: {
    getPublicIp: (proxyUrl?: string) =>
      ipcRenderer.invoke('privacy:getPublicIp', proxyUrl),
    testProxy: (proxyUrl: string) =>
      ipcRenderer.invoke('privacy:testProxy', proxyUrl),
    setProxy: (proxyUrl: string | null) =>
      ipcRenderer.invoke('privacy:setProxy', proxyUrl),
  },

  devServer: {
    detect: (rootPath: string) => ipcRenderer.invoke('devServer:detect', rootPath),
    start: (rootPath: string) => ipcRenderer.invoke('devServer:start', rootPath),
    stop: () => ipcRenderer.invoke('devServer:stop'),
    status: () => ipcRenderer.invoke('devServer:status'),
    logs: () => ipcRenderer.invoke('devServer:logs'),
    diagnose: () => ipcRenderer.invoke('devServer:diagnose'),
    onLog: (cb: (line: string) => void) => {
      const listener = (_e: any, line: string) => cb(line);
      ipcRenderer.on('devServer:log', listener);
      return () => ipcRenderer.removeListener('devServer:log', listener);
    },
    onReady: (cb: (data: { url: string; framework: string }) => void) => {
      const listener = (_e: any, data: any) => cb(data);
      ipcRenderer.on('devServer:ready', listener);
      return () => ipcRenderer.removeListener('devServer:ready', listener);
    },
    onExit: (cb: (data: { code: number | null; signal: string | null }) => void) => {
      const listener = (_e: any, data: any) => cb(data);
      ipcRenderer.on('devServer:exit', listener);
      return () => ipcRenderer.removeListener('devServer:exit', listener);
    },
  },

  terminal: {
    run: (sessionId: string, cmd: string, cwd: string) =>
      ipcRenderer.invoke('terminal:run', sessionId, cmd, cwd),
    kill: (sessionId: string) =>
      ipcRenderer.invoke('terminal:kill', sessionId),
    isRunning: (sessionId: string) =>
      ipcRenderer.invoke('terminal:isRunning', sessionId),
    onOutput: (cb: (data: { sessionId: string; data: string; kind: 'stdout' | 'stderr' }) => void) => {
      const listener = (_e: any, payload: any) => cb(payload);
      ipcRenderer.on('terminal:output', listener);
      return () => ipcRenderer.removeListener('terminal:output', listener);
    },
    onExit: (cb: (data: { sessionId: string; code: number | null; signal: string | null }) => void) => {
      const listener = (_e: any, payload: any) => cb(payload);
      ipcRenderer.on('terminal:exit', listener);
      return () => ipcRenderer.removeListener('terminal:exit', listener);
    },
  },
});
