# AI IDE v2.8.0 — zmiany

## Nowe
- **Aktualizacje z GitHuba** (Ustawienia → Aktualizacje). Sprawdzanie ręczne lub auto przy starcie. Pobranie i instalacja jednym klikiem (electron-updater + GitHub Releases). Toggle "Sprawdzaj automatycznie przy starcie" — domyślnie WŁĄCZONY.
- **Ollama** zintegrowana jako lokalny provider (free, offline po pobraniu modelu). Auto-detekcja działającego serwera Ollama na `127.0.0.1:11434`. Wybór i pobieranie modeli bezpośrednio z UI z paskiem postępu. Rekomendowane modele oznaczone ⭐ (Llama 3.1 8B — ogólny, Qwen 2.5 Coder 7B — kod). Pełna lista rozmiarów od 2B do 70B z informacją o RAM i miejscu na dysku. Wpisanie "OpenViking" w prompcie zostało zinterpretowane jako Ollama (nie znalazłem produktu o nazwie OpenViking — najpewniej przejęzyczenie).
- **Większa, lepiej widoczna ikona ustawień** w pasku tytułowym (SVG zębatka 18 px zamiast jednoznakowego "⚙").

## Poprawione
- **Paski przewijania**: nowy styl (gradient, zaokrąglone, glow przy hover) plus warianty `.scrollbar-thin` i `.scrollbar-auto`. Wszystkie listy w aplikacji (czat, podgląd, snippety, lista repo, log dev servera, mention popup, ustawienia) używają teraz cienkiego, ładnego paska. Wsparcie dla `scrollbar-width: thin` w Firefoxie.
- **Podgląd strony** uruchamia się znacznie szybciej — `status`, `detect` i `preview.start` lecą równolegle (Promise.allSettled) zamiast sekwencyjnie. Dodatkowo cache ostatniego URL per projekt — przełączenie projektu nie powoduje już migotania białego iframe.
- **Sticky prawy panel**: pasek modeli i pole inputu mają stały shadow + z-index — niezależnie od długości rozmowy ZAWSZE widać górny pasek wyboru AI i dolne pole pisania. Pasek modeli ma teraz cienki, ładny scrollbar przy wielu modelach.
- **Instalator DMG**: przed budowaniem skrypt automatycznie odmontowuje wcześniej podpięte woluminy `/Volumes/AI IDE *` — naprawia błąd `hdiutil detach exit code 16`, na który napotkałem w logu instalacji.

## Pomniejsze
- Auto-update sprawdza dostępność w tle 3 sekundy po starcie (cicho, bez blokowania UI). Pobieranie zawsze wymaga kliku.
- `package.json`: dodana sekcja `build.publish` z provider `github` (releases.AI_IDE).
- Default `autoUpdate = true` w settingsStore (toggle w zakładce Aktualizacje pozwala wyłączyć).
- Czyszczenie tła pod inputem (`bg-[#0c0c10]`) — koniec semi-przezroczystego paska przy długich wiadomościach.

---

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
