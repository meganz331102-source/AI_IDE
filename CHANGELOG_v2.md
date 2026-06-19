# AI IDE v2.19.0 — chat overflow, dev-server loop, model picker

## Naprawione
- **Chat wychodzi poza obrys aplikacji po otwarciu repo** — `html`, `body`, `#root` dostały `overflow: hidden` + `width: 100%`, root `<App>` dostał `overflow-hidden`, clamp kolumn reaguje też na zmianę `rootPath` (pierwszy render gridu po Welcome → Project).
- **Podgląd dev-servera odpalał się i sam wyłączał w pętli** — `dev-server.ts` przestał próbować restartować Next.js po wykryciu "Another next dev server already running". Logika kasowała PID i recursive `start()`, a każdy nowy spawn znów widział ten sam komunikat → nieskończona pętla restartów. Teraz po prostu logujemy info i czekamy aż regex URL złapie nowy port (Next.js sam przeskakuje z 3000 na 3001).

## Nowe
- **Nowy picker modeli AI** (`ModelPicker.tsx`) — zamiast horyzontalnego scrolla buttonów, kompaktowy dropdown z wyszukiwarką, grupowaniem po providerze (Pollinations / Groq / Ollama / Eksperymentalne), opisem każdego modelu i badge'ami statusu (FREE / KLUCZ / LOCAL / BETA). Pokazuje aktywny model + jego opis w pasku zwiniętym, w rozwiniętym filtrowanie po nazwie i opisie.

# AI IDE v2.18.0 — major bugfixes

## Naprawione
- **Podgląd blank-outuje się przy kliknięciu w link** — `PICKER_SCRIPT` w `preview-server.ts` teraz przechwytuje external anchor clicks (`http://`, `mailto:`, `target="_blank"`) i form submits, nie pozwalając im wywalić iframe na `about:blank`. External linki idą jako `AIIDE_OPEN_EXTERNAL` do parenta. Picker w trybie aktywnym ma fallback na `document.elementFromPoint` gdy `hoveredEl` jest null.
- **Czat się rozjeżdża przy długich code-blockach** — bubble messages dostały `min-w-0 max-w-full overflow-hidden`, scroll container dostał `min-w-0 overflow-x-hidden`. `<pre>` w markdown ma teraz `max-width: 100%` i `code` w środku `white-space: pre` (nie zawija na sztywno, scrolluje horyzontalnie w bubble). Długi kod nie rozpycha już kolumny.
- **Kolumna czatu źle się skaluje przy resize okna** — clamp logic w `App.tsx` odwrócony: priorytetem jest teraz CHAT, nie FileExplorer. Najpierw kurczy się left (drzewo plików), potem right (chat). Skrajny przypadek (okno < suma minimów) daje chat 240px minimum zamiast wycinania. Grid kolumn dostał `minmax(0, 1fr)` zamiast `1fr` plus każdy child opakowany w `min-w-0 overflow-hidden` — to faktyczna naprawa "content rozpycha kolumnę".

# AI IDE v2.9.0 — zmiany

## Nowe
- **Nowa paleta kolorów** w całej aplikacji: teal (`#22577a`, `#38a3a5`) → green (`#57cc99`, `#80ed99`, `#c7f9cc`) jako podstawa interfejsu, plus orange (`#f48c06`, `#faa307`, `#ffba08`) dla ostrzeżeń. Tło zmienione z neutralnej czerni na ciepło-teal `#0a1216`. Wszystkie scrollbary, splittery, przyciski, ringi focusu, hover-stany i akcent-aktywne dostały kolory z palety.
- **Tryb "⫶ Split" w panelu środkowym** — kod i podgląd strony obok siebie, draggable splitter, proporcje zapisywane w localStorage (20–80%). Trzecia zakładka oprócz "📝 Kod" i "👁 Podgląd".
- **Live Preview** w trybie Split: gdy edytowany plik to `.html` z projektu, iframe automatycznie nawiguje do tego pliku. Po każdym zapisie (`⌘S` w edytorze, accept AI change, auto-apply) iframe sam się odświeża po 120 ms. Badge "● LIVE" w toolbarze podglądu.
- **Scrollbar w lewej kolumnie** (drzewo plików) — jawnie cienki, w palecie teal/green, plus `scrollbar-thin`. Kolumna ma teraz prawidłowe `min-h-0` i `shrink-0` na nagłówku/footerze.

## Naprawione
- **Czat nie działał** (regresja po v2.8.0). Pollinations bywa flaky → dodany timeout 60 s + automatyczny 1× retry przy 5xx/błędach sieciowych. Pusta odpowiedź i błędy providera teraz typowane (`PROVIDER_DOWN`, `RATE_LIMIT`, `EMPTY_RESPONSE`) z sugestią zmiany providera na Groq/Ollamę w UI.
- **UI nieprawidłowo skalowane** — usunąłem agresywny `min-height: 96 px` i `box-shadow: 0 -8px 16px -8px` z `.chat-input-area` które w v2.8.0 powodowały wizualne ucinanie treści. Textarea czatu skrócona z 3 do 2 wierszy. Przyciski akcji (🗑/🌐/⚡) zmniejszone z 32×32 px do 28×28 px. Padding inputu zredukowany.
- **Skrót ⌘S/Ctrl+S** w edytorze kodu — wcześniej nie istniał, teraz zapisuje aktywny plik.

## Pomniejsze
- `MiddlePanel` zapamiętuje aktywną zakładkę (`localStorage`).
- Nowy `tailwind.config.js` z paletą jako theme.extend.colors (brand.*, warn.*, bg.*).
- Splittery mają glow przy hover (`box-shadow rgba(56,163,165,0.6)`).
- `FileExplorer` pokazuje informację gdy projekt nie ma plików lub wyszukiwarka nic nie znalazła.
- Ikona projektu w "Otwórz projekt" dostała emoji 📁 i `truncate` na długich ścieżkach.

---

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
