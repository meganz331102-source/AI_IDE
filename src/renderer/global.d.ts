import type {
  AIModelId,
  ProjectFile,
  SelectedContextFile,
  ProposedChange,
  SessionStatus,
} from '../shared/types';

declare global {
  interface Window {
    aiIDE: {
      fs: {
        openProjectDialog: () => Promise<string | null>;
        readDirectory: (rootPath: string) => Promise<ProjectFile[]>;
        readFileContent: (absolutePath: string) => Promise<string>;
        writeFileContent: (absolutePath: string, content: string) => Promise<void>;
        deleteFile: (absolutePath: string) => Promise<void>;
      };
      git: {
        status: (repoPath: string) => Promise<unknown>;
        commit: (repoPath: string, message: string) => Promise<{ commitHash: string }>;
        createBranch: (repoPath: string, branchName: string) => Promise<void>;
        createPullRequest: (
          owner: string,
          repo: string,
          head: string,
          base: string,
          title: string,
          body: string
        ) => Promise<{ url: string; number: number }>;
        listRepos: () => Promise<Array<{
          fullName: string;
          htmlUrl: string;
          cloneUrl: string;
          isPrivate: boolean;
          description: string | null;
          updatedAt: string;
        }>>;
        getUser: () => Promise<{ login: string; avatarUrl: string; name: string | null } | null>;
        cloneRepo: (cloneUrl: string) => Promise<{ localPath: string; alreadyExisted: boolean }>;
      };
      shell: {
        openExternal: (url: string) => Promise<void>;
      };
      preview: {
        start: (rootPath: string) => Promise<{ port: number; url: string; indexPath: string | null }>;
        setRoot: (rootPath: string) => Promise<void>;
        stop: () => Promise<void>;
        listHtml: (rootPath: string) => Promise<string[]>;
      };
      search: {
        inFiles: (rootPath: string, query: string) => Promise<Array<{
          filePath: string;
          relativePath: string;
          lineNum: number;
          line: string;
        }>>;
      };
      privacy: {
        getPublicIp: (proxyUrl?: string) => Promise<{
          ip: string;
          country: string | null;
          city: string | null;
          org: string | null;
        }>;
        testProxy: (proxyUrl: string) => Promise<{
          ok: boolean;
          directIp?: string;
          proxiedIp?: string;
          changed?: boolean;
          error?: string;
        }>;
        setProxy: (proxyUrl: string | null) => Promise<void>;
      };
      devServer: {
        detect: (rootPath: string) => Promise<{ framework: string; defaultPort: number; installed: boolean } | null>;
        start: (rootPath: string) => Promise<{ ok: boolean; framework: string; url?: string; error?: string }>;
        stop: () => Promise<void>;
        status: () => Promise<{ running: boolean; url?: string | null; framework?: string; rootPath?: string }>;
        logs: () => Promise<string>;
        diagnose: () => Promise<{ path: string; npm: string | null; node: string | null }>;
        onLog: (cb: (line: string) => void) => () => void;
        onReady: (cb: (data: { url: string; framework: string }) => void) => () => void;
        onExit: (cb: (data: { code: number | null; signal: string | null }) => void) => () => void;
      };
      terminal: {
        run: (sessionId: string, cmd: string, cwd: string) => Promise<{ code: number | null; signal: string | null }>;
        kill: (sessionId: string) => Promise<void>;
        isRunning: (sessionId: string) => Promise<boolean>;
        onOutput: (cb: (data: { sessionId: string; data: string; kind: 'stdout' | 'stderr' }) => void) => () => void;
        onExit: (cb: (data: { sessionId: string; code: number | null; signal: string | null }) => void) => () => void;
      };
      ai: {
        startSession: (modelId: AIModelId) => Promise<SessionStatus>;
        sendMessage: (modelId: AIModelId, prompt: string) => Promise<string>;
        getSessionStatus: (modelId: AIModelId) => Promise<SessionStatus>;
        showLoginWindow: (modelId: AIModelId) => Promise<void>;
        abort: (modelId: AIModelId) => Promise<void>;
        resetSession: (modelId: AIModelId) => Promise<void>;
        setKey: (provider: string, key: string) => Promise<void>;
        hasKey: (provider: string) => Promise<boolean>;
        clearKey: (provider: string) => Promise<void>;
        closeBrowser: () => Promise<void>;
        isBrowserOpen: () => Promise<boolean>;
        openChatGPTVisible: () => Promise<boolean>;
      };
      context: {
        buildContext: (filePaths: string[]) => Promise<SelectedContextFile[]>;
        rankRelevantFiles: (rootPath: string, query: string) => Promise<string[]>;
      };
      changes: {
        applyChange: (change: ProposedChange) => Promise<void>;
      };
      keychain: {
        setGitHubToken: (token: string) => Promise<void>;
        hasGitHubToken: () => Promise<boolean>;
        clearGitHubToken: () => Promise<void>;
      };
      updater: {
        check: () => Promise<{ ok: boolean; version?: string | null; error?: string }>;
        download: () => Promise<{ ok: boolean; error?: string }>;
        install: () => Promise<void>;
        getCurrentVersion: () => Promise<string | null>;
        on: (
          event: 'checking' | 'available' | 'not-available' | 'error' | 'progress' | 'downloaded',
          cb: (payload: any) => void,
        ) => () => void;
      };
      ollama: {
        ping: () => Promise<boolean>;
        list: () => Promise<Array<{ name: string; size: number; modified_at: string }>>;
        pull: (model: string) => Promise<{ ok: boolean; error?: string }>;
        cancelPull: (model: string) => Promise<void>;
        delete: (model: string) => Promise<{ ok: boolean; error?: string }>;
        onPullProgress: (
          cb: (p: { model: string; status: string; completed: number; total: number; percent: number | null }) => void,
        ) => () => void;
      };
    };
  }
}

export {};
