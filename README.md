# AI IDE — lokalne środowisko programistyczne wspomagane wieloma modelami AI

Natywna aplikacja desktopowa dla macOS, która łączy edytor kodu z dostępem do
ChatGPT, Claude, Gemini i DeepSeek **bez korzystania z oficjalnych API** —
wykorzystuje istniejące, zalogowane sesje przeglądarki użytkownika.

## Dokumentacja

- [`docs/ARCHITEKTURA.md`](docs/ARCHITEKTURA.md) — pełna architektura, przepływy danych, Context Manager, system agentów, ograniczenia
- [`docs/BUDOWANIE.md`](docs/BUDOWANIE.md) — instrukcja budowania, podpisywania i dystrybucji .dmg

## Szybki start — instalacja jednym kliknięciem

1. Rozpakuj cały folder `ai-ide` (np. na Pulpit).
2. **Kliknij dwa razy** plik **`Zainstaluj_AI_IDE.command`**.
   - Jeśli macOS pokaże ostrzeżenie "nie można zweryfikować dewelopera": kliknij prawym przyciskiem na plik → **Otwórz** → potwierdź **Otwórz** w oknie dialogowym (trzeba to zrobić tylko przy pierwszym uruchomieniu).
3. Otworzy się okno terminala, które samo zainstaluje wszystko, czego potrzeba (Node.js, zależności, Chromium dla sesji AI) i zbuduje gotową aplikację. Trwa to zwykle 3–8 minut.
4. Na końcu otworzy się okno z plikiem **AI IDE.app** (albo instalator .dmg) — przeciągnij go do folderu **Applications**.
5. Od teraz **AI IDE** jest normalną aplikacją — odpalasz ją klikając ikonę w Launchpad / Applications, tak jak każdy inny program. Żadnych komend już nie potrzeba.

To trzeba zrobić tylko raz. Pliki `Zainstaluj_AI_IDE.command` i resztę folderu projektu można potem usunąć — gotowa appka jest już samodzielna w Applications.

> Jeśli dwuklik na `Zainstaluj_AI_IDE.command` nic nie robi (czasem rozpakowywanie zipa "gubi" uprawnienia do wykonania), otwórz Terminal, wpisz `chmod +x ` (ze spacją na końcu), przeciągnij plik `.command` do okna terminala i wciśnij Enter — to nada uprawnienia. Potem dwuklik zadziała normalnie.

### Alternatywa dla programistów (Terminal, bez .command)

```bash
npm install
npm run playwright:install
npm run dev
```

## Status implementacji (MVP)

| Funkcja | Status |
|---|---|
| Electron + React + Monaco shell | ✅ |
| File Explorer z zaznaczaniem plików do kontekstu | ✅ |
| Sesje przeglądarki (Playwright) dla 4 modeli | ✅ szkielet, selektory DOM wymagają weryfikacji na żywo |
| Context Manager (token budgeting, chunking) | ✅ wersja podstawowa |
| Parser zmian z odpowiedzi AI + Diff Viewer | ✅ |
| Akceptacja/odrzucenie zmian przed zapisem | ✅ |
| GitHub PAT w Keychain + commit/branch/PR | ✅ |
| System agentów (Backend/Frontend/Testing...) | 🔲 zaplanowane w architekturze, brak implementacji UI |
| File Relevance Ranking (AST-based) | 🔲 placeholder oparty na nazwach plików |
| SQLite – trwała historia rozmów | 🔲 zaplanowane |

## Najważniejsze ograniczenie

To podejście automatyzuje interfejs webowy serwisów AI, więc **selektory DOM w
`src/shared/constants.ts` się dezaktualizują**, gdy dostawca zmieni swój UI.
Przed pierwszym użyciem warto zweryfikować je manualnie (DevTools → Inspect)
na aktualnej wersji każdego serwisu. Szczegóły w `docs/ARCHITEKTURA.md` §8.
