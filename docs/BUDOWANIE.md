# Budowanie i dystrybucja – AI IDE (macOS)

## Wymagania

- macOS 12+ (Apple Silicon lub Intel)
- Node.js 20+
- Xcode Command Line Tools (`xcode-select --install`)

## 1. Instalacja zależności

```bash
cd ai-ide
npm install
npm run playwright:install   # pobiera Chromium dla Playwright
```

## 2. Uruchomienie w trybie deweloperskim

```bash
npm run dev
```

To uruchamia równolegle:
- Vite dev server (renderer, hot reload) na `http://localhost:5173`
- Kompilację TypeScript dla Electron main process w trybie watch
- Aplikację Electron, która łączy się z Vite dev serverem

## 3. Build produkcyjny (bez pakowania)

```bash
npm run build
```

Tworzy:
- `dist/` – zbudowany frontend (Vite)
- `dist-electron/` – skompilowany main process i preload

## 4. Pakowanie do .app / .dmg

```bash
npm run dist:dmg
```

Wynik w katalogu `release/`:
- `AI IDE-0.1.0.dmg` – instalator do dystrybucji
- `AI IDE-0.1.0-mac.zip` – archiwum dla auto-update

## 5. Podpisywanie i notaryzacja (dystrybucja poza Mac App Store)

Aby aplikacja działała bez ostrzeżeń Gatekeeper na innych komputerach:

```bash
# 1. Wymagany Apple Developer ID Certificate (z Twojego konta Apple Developer)
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=twoje_haslo_certyfikatu

# 2. Notaryzacja wymaga Apple ID + app-specific password
export APPLE_ID=twoj@apple.id
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
export APPLE_TEAM_ID=XXXXXXXXXX

npm run dist:dmg
```

electron-builder automatycznie podpisze i wyśle aplikację do notaryzacji Apple,
o ile zmienne środowiskowe są ustawione.

## 6. Pierwsze uruchomienie – logowanie do serwisów AI

Aplikacja **nie zawiera wbudowanych kont AI**. Przy pierwszym wyborze modelu
(np. Claude) otworzy się osobne okno Playwright/Chromium – użytkownik loguje się
tam normalnie jak w przeglądarce. Sesja zostaje zapisana lokalnie w:

```
~/Library/Application Support/ai-ide/ai-profiles/<model>/
```

## 6b. Ostrzeżenie Gatekeeper przy pierwszym odpaleniu zbudowanej appki

Skrypt `Zainstaluj_AI_IDE.command` buduje appkę **niepodpisaną** (bez płatnego
Apple Developer ID). macOS przy pierwszym kliknięciu `AI IDE.app` w Applications
pokaże komunikat "nie można zweryfikować dewelopera" lub "aplikacja jest
uszkodzona". To nie jest błąd – to standardowe zachowanie Gatekeeper dla appek
spoza Mac App Store / App Store podpisu. Aby to obejść:

- Kliknij prawym przyciskiem na **AI IDE.app** → **Otwórz** → potwierdź **Otwórz**
  w oknie dialogowym (tylko raz, przy pierwszym uruchomieniu).
- Jeśli to nie pomoże, w Terminalu jednorazowo: `xattr -cr "/Applications/AI IDE.app"`

Aby appka była w 100% bez ostrzeżeń dla innych użytkowników, potrzebny jest
płatny certyfikat Apple Developer ID i notaryzacja – patrz punkt 5 wyżej.

## 7. Rozwiązywanie problemów

| Problem | Rozwiązanie |
|---------|-------------|
| `keytar` błąd kompilacji natywnej | `npm rebuild keytar` lub doinstaluj Xcode CLT |
| Sesja AI nie wykrywa logowania | Selektory DOM w `src/shared/constants.ts` wymagają aktualizacji – serwis zmienił UI |
| Playwright nie startuje | Sprawdź czy `npm run playwright:install` zakończyło się sukcesem |
| Aplikacja niepodpisana – Gatekeeper blokuje | Notarize zgodnie z punktem 5, lub w trakcie testów: `xattr -cr "AI IDE.app"` |
