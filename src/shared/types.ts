// Wspólne typy używane w main process (Electron) oraz renderer (React)

export type AIModelId = 'pollinations' | 'pollinations-mistral' | 'pollinations-llama' | 'groq' | 'duckai' | 'chatgpt' | 'gemini' | 'deepseek' | 'ollama';

export interface AIModelConfig {
  id: AIModelId;
  label: string;
  url: string;
  /** Selektory DOM – wymagają okresowej aktualizacji gdy serwis zmienia UI */
  selectors: {
    promptInput: string;
    sendButton: string;
    responseContainer: string;
    loginIndicator: string; // element widoczny tylko gdy zalogowany
  };
}

export interface ProjectFile {
  path: string;          // ścieżka relatywna do root projektu
  absolutePath: string;
  name: string;
  isDirectory: boolean;
  children?: ProjectFile[];
  sizeBytes?: number;
}

export interface SelectedContextFile {
  path: string;
  content: string;
  tokenEstimate: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelId: AIModelId;
  timestamp: number;
  attachedFiles?: string[]; // paths
}

export interface ProposedChange {
  id: string;
  filePath: string;
  type: 'create' | 'modify' | 'delete';
  originalContent: string | null; // null jeśli create
  newContent: string | null;      // null jeśli delete
  status: 'pending' | 'accepted' | 'rejected';
}

export interface ContextBudget {
  maxTokens: number;
  systemPromptTokens: number;
  reserveForResponseTokens: number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  defaultModel: AIModelId;
  allowedActions: AgentAction[];
}

export type AgentAction =
  | 'read_file'
  | 'propose_write'
  | 'propose_create'
  | 'propose_delete'
  | 'git_status'
  | 'git_commit'
  | 'git_branch';

export interface GitHubSettings {
  hasToken: boolean; // nigdy nie wysyłamy samego tokenu do renderera
}

export interface SessionStatus {
  modelId: AIModelId;
  isLoggedIn: boolean;
  isReady: boolean;
  lastError?: string;
}
