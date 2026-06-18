#!/bin/bash
# ============================================================
# AI IDE — Instalator (kliknij dwa razy, żeby zbudować appkę)
# ============================================================
# Ten plik trzeba odpalić TYLKO RAZ. Po jego zakończeniu
# powstanie gotowa aplikacja "AI IDE.app", którą można
# przenieść do Applications i odpalać już samym klikaniem.
# ============================================================

set -e
cd "$(dirname "$0")"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}   AI IDE — instalacja i budowanie appki   ${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# --- 1. Sprawdzenie Node.js ---
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}Nie znaleziono Node.js.${NC}"
  echo "Instaluję Node.js przez Homebrew (potrzebne tylko raz)..."

  if ! command -v brew >/dev/null 2>&1; then
    echo "Instaluję Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
  fi

  brew install node
fi

echo -e "${GREEN}✓ Node.js: $(node -v)${NC}"

# --- 2. Sprawdzenie Xcode Command Line Tools (potrzebne dla keytar) ---
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Instaluję Xcode Command Line Tools (pojawi się okno systemowe)..."
  xcode-select --install || true
  echo ""
  echo -e "${RED}WAŻNE: Zakończ instalację w oknie, które się pojawiło,${NC}"
  echo -e "${RED}a potem odpal ten plik ponownie.${NC}"
  read -p "Naciśnij Enter, gdy instalacja Xcode CLT się zakończy..."
fi

echo -e "${GREEN}✓ Xcode Command Line Tools obecne${NC}"

# --- 3. Instalacja zależności npm ---
echo ""
echo "Instaluję zależności (to może potrwać 2-5 minut)..."
npm install

# --- 4. Instalacja Chromium dla Playwright ---
echo ""
echo "Instaluję Chromium (silnik sesji AI w przeglądarce)..."
npx playwright install chromium

# --- 4b. Konwersja ikony aplikacji (.iconset -> .icns) ---
if [ -d "build/AppIcon.iconset" ] && [ ! -f "build/icon.icns" ]; then
  echo ""
  echo "Generuję ikonę aplikacji..."
  iconutil -c icns build/AppIcon.iconset -o build/icon.icns || true
fi

if [ ! -f "build/icon.icns" ]; then
  echo "(Ikona niestandardowa niedostępna — appka zbuduje się z domyślną ikoną Electrona)"
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    if (pkg.build && pkg.build.mac) delete pkg.build.mac.icon;
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
  "
fi

# --- 5. Build aplikacji ---
echo ""
echo "Czyszczę pozostałości poprzedniej kompilacji..."
rm -rf dist dist-electron release

echo ""
echo "Buduję aplikację..."
npm run build

# --- 6. Pakowanie do .app / .dmg ---
echo ""
echo "Pakuję do AI IDE.app i .dmg (to też potrwa kilka minut)..."
npx electron-builder --mac --dir
npx electron-builder --mac dmg

# --- 7. Znajdź zbudowaną appkę i otwórz Findera ---
APP_PATH=$(find release -maxdepth 2 -name "*.app" | head -n 1)
DMG_PATH=$(find release -maxdepth 1 -name "*.dmg" | head -n 1)

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}   Gotowe! Aplikacja została zbudowana.   ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

if [ -n "$DMG_PATH" ]; then
  echo "Otwieram instalator .dmg — przeciągnij ikonę AI IDE do Applications."
  open "$DMG_PATH"
elif [ -n "$APP_PATH" ]; then
  echo "Otwieram folder z aplikacją — przeciągnij ją do Applications."
  open -R "$APP_PATH"
fi

echo ""
echo "Od teraz wystarczy kliknąć ikonę 'AI IDE' w Applications (lub Launchpad)."
echo "To okno terminala można zamknąć."
echo ""
read -p "Naciśnij Enter, aby zamknąć to okno..."
