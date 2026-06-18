# AI IDE – Dokumentacja architektury

## 1. Przegląd systemu

Lokalna aplikacja desktopowa dla macOS działająca jako IDE wspomagane przez wiele modeli AI. Aplikacja **nie korzysta z oficjalnych API** – zamiast tego automatyzuje istniejące sesje przeglądarki użytkownika.

---

## 2. Stack technologiczny

| Warstwa | Technologia | Uzasadnienie |
|---------|------------|--------------|
| Desktop shell | **Electron** | Pełna kontrola nad BrowserView, Keychain, natywne menu macOS |
| UI Framework | **React 18 + TypeScript** | Komponenty, hooks, type safety |
| Stylowanie | **TailwindCSS** | Utility-first, dark mode out of the box |
| Edytor kodu | **Monaco Editor** | Silnik VS Code – syntax highlighting, diff, IntelliSense |
| Backend (main) | **Node.js** (Electron main process) | IPC, file system, SQLite, Git |
| Automatyzacja | **Playwright** (embedded Chromium) | Sterowanie sesją przeglądarki AI |
| Baza danych | **better-sqlite3** | Lokalna, synchroniczna, zero konfiguracji |
| Git | **simple-git** | Node.js wrapper na git CLI |
| Bezpieczeństwo | **keytar** | Dostęp do macOS Keychain |

---

## 3. Struktura katalogów

```
ai-ide/
├── electron/
│   ├── main.ts              # Główny proces Electron
│   ├── preload.ts           # Bridge IPC (contextBridge)
│   └── ipc/
│       ├── fileSystem.ts    # Operacje na plikach
│       ├── git.ts           # Integracja Git/GitHub
│       ├── browser.ts       # Playwright – sesje AI
│       ├── context.ts       # Context Manager
│       └── keychain.ts      # macOS Keychain
├── src/
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FileExplorer/
│   │   │   ├── CodeEditor/
│   │   │   ├── AIChatPanel/
│   │   │   ├── DiffViewer/
│   │   │   └── Settings/
│   │   ├── hooks/
│   │   │   ├── useAISession.ts
│   │   │   ├── useFileContext.ts
│   │   │   └── useGitOps.ts
│   │   └── store/
│   │       ├── editorStore.ts
│   │       ├── chatStore.ts
│   │       └── projectStore.ts
│   └── shared/
│       ├── types.ts
│       └── constants.ts
├── scripts/
│   └── build.sh
├── package.json
└── electron-builder.yml
```

---

## 4. Przepływ danych

### 4.1 Wysyłanie wiadomości do AI

```
Użytkownik wybiera pliki → FileExplorer
       ↓
Context Manager zbiera treść plików (z limitem tokenów)
       ↓
AIChatPanel buduje prompt: [systemPrompt] + [kontekst plików] + [wiadomość użytkownika]
       ↓
IPC call → electron/ipc/browser.ts
       ↓
Playwright.page.fill('#prompt-textarea', prompt)
Playwright.page.click('[data-testid="send-button"]')
       ↓
Polling / MutationObserver na DOM odpowiedzi
       ↓
Zwrot tekstu odpowiedzi → IPC → AIChatPanel
       ↓
Parser wykrywa bloki kodu i diff → propozycja zmian
       ↓
DiffViewer – użytkownik akceptuje lub odrzuca
       ↓
fileSystem.writeFile() – zapis tylko po akceptacji
```

### 4.2 Inicjalizacja sesji AI

```
Uruchomienie aplikacji
       ↓
Playwright.launch({ headless: false, userDataDir: ~/.ai-ide/profiles/<model> })
       ↓
Ładowanie osobnego profilu dla każdego modelu
       ↓
Sprawdzenie stanu logowania (URL, DOM)
       ↓
Jeśli wylogowany → pokazanie okna logowania użytkownikowi
       ↓
Sesja gotowa → isReady = true
       ↓
BrowserView schowana za głównym oknem aplikacji
```

---

## 5. Context Manager

System minimalizacji tokenów:

```typescript
interface ContextBudget {
  maxTokens: number;       // np. 8000
  systemPrompt: number;    // ~500
  reserveForResponse: number; // ~2000
  availableForFiles: number;  // maxTokens - systemPrompt - reserve
}

// Algorytm selekcji plików:
// 1. Pliki zaznaczone przez użytkownika (priorytet 1)
// 2. Pliki importowane przez zaznaczone (analiza AST/regex)
// 3. Pliki ostatnio edytowane (priorytet 3)
// 4. Chunking dla plików > 200 linii
```

---

## 6. System agentów

Agent = zestaw instrukcji systemowych + pętla wykonania:

```typescript
interface Agent {
  id: string;
  name: string;           // np. "Backend Agent"
  systemPrompt: string;   // specjalistyczne instrukcje
  model: AIModel;         // aktualnie wybrany model
  allowedActions: AgentAction[]; // jakie operacje może wykonywać
}

type AgentAction = 
  | 'read_file'
  | 'write_file'     // zawsze przez DiffViewer
  | 'create_file'    // zawsze przez DiffViewer
  | 'run_command'    // sandbox – tylko read-only komendy
  | 'git_commit'
  | 'git_branch';
```

---

## 7. Bezpieczeństwo

- **Keychain**: GitHub PAT przechowywany w macOS Keychain via `keytar`
- **Sandbox**: Renderer process bez `nodeIntegration` – tylko preload API
- **Brak external servers**: Żaden kod użytkownika nie opuszcza maszyny poza sesją AI
- **Izolacja profili**: Każdy model w osobnym userDataDir Playwright
- **Akceptacja zmian**: AI nie może samodzielnie zapisać pliku – zawsze DiffViewer

---

## 8. Ograniczenia wynikające z automatyzacji przeglądarki

| Ograniczenie | Szczegóły |
|-------------|-----------|
| **Niestabilność selektorów DOM** | ChatGPT, Claude, Gemini często zmieniają atrybuty DOM. Selektory wymagają regularnej aktualizacji. |
| **Rate limiting** | Darmowe plany mają limity wiadomości (np. GPT-4o: ~80/3h). Aplikacja powinna monitorować i informować użytkownika. |
| **Captcha / bot detection** | Serwisy mogą wykrywać automatyzację. Playwright z prawdziwym profilem zmniejsza ryzyko. |
| **Brak structured output** | Brak JSON mode / function calling. Odpowiedzi są surowym tekstem – wymagają parsowania. |
| **Czas odpowiedzi** | Wolniejsze niż API – trzeba czekać na streaming zakończony przez DOM. |
| **Zmiany UI** | Każda aktualizacja interfejsu serwisu AI może zepsuć integrację. |
| **Warunki użytkowania** | Automatyzacja może naruszać ToS serwisów AI – użytkownicy powinni to rozważyć. |

---

## 9. MVP – zakres minimalny

Etap 1 (MVP):
- [ ] Electron + React shell
- [ ] Monaco Editor (podstawowy)
- [ ] File Explorer (read-only zaznaczanie)
- [ ] Playwright session dla Claude.ai
- [ ] Chat panel (wysyłanie/odbieranie wiadomości)
- [ ] Podstawowy Context Manager (zaznaczone pliki)
- [ ] Diff viewer (podgląd zmian)
- [ ] Zapis pliku po akceptacji

Etap 2:
- [ ] Dodatkowe modele (ChatGPT, Gemini, DeepSeek)
- [ ] GitHub PAT + basic Git ops
- [ ] SQLite historia rozmów
- [ ] macOS Keychain

Etap 3:
- [ ] Agenci
- [ ] Advanced Context Manager (AST, ranking)
- [ ] Chunking dużych plików
- [ ] Auto-update selektorów DOM

---

## 10. Roadmapa

```
Q1  MVP (Claude.ai + Monaco + File Explorer + Diff)
Q2  Multi-model + GitHub integration + Keychain
Q3  Agent system + Advanced context + Plugin API
Q4  Auto-update, dystrybucja DMG, notarization Apple
```
