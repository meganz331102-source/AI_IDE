# AI IDE v2.0.0 — zmiany

## Naprawione
- **Tryb incognito DZIAŁA**: każda sesja AI używa świeżego `browser.newContext()` bez `userDataDir` — żadne cookies/cache nie są zapisywane na dysku.
- **Wysyłanie/odbieranie wiadomości**: przepisany `waitForNewResponse` liczy wiadomości PRZED wysłaniem i czeka aż pojawi się nowa, potem aż streaming się ustabilizuje (3 stabilne odczyty po 800 ms). Wpisywanie używa `keyboard.type` z opóźnieniem (działa dla textarea i contenteditable). Fallback Enter gdy przycisk Send nie odpowiada.
- **Pasek tytułu**: napis „AI IDE" przesunięty o 88 px w prawo, nie nachodzi na kropki sterowania macOS. Cały pasek jest regionem przeciągania okna.

## Zmienione
- **Claude → Duck.ai**: domyślny model to teraz Duck.ai (nie wymaga logowania). Pozostałe: ChatGPT, Gemini, DeepSeek.
- **Headless**: przeglądarka uruchamia się w tle, użytkownik jej nie widzi. Logowanie (gdy potrzebne dla ChatGPT/Gemini/DeepSeek) wciąż otwiera widoczne okno Electrona — po jego zamknięciu cookies są przeniesione do headless kontekstu.
- **Otwieranie projektu**: przycisk „Otwórz projekt" widoczny teraz także w pasku tytułu (oprócz dotychczasowego w File Explorerze). Wybieranie plików do kontekstu AI działa przez checkboxy w drzewie plików.
- **Wersja**: `2.0.0`. Plik wynikowy: `AI_IDE_v2.0.0.dmg` (electron-builder używa teraz `artifactName: AI_IDE_v${version}.${ext}`).

## Budowanie
```bash
npm install
npm run playwright:install   # pobiera Chromium dla Playwright
npm run dist:dmg             # produkuje release/AI_IDE_v2.0.0.dmg
```
