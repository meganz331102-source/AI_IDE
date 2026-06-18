#!/bin/bash
set -e
cd "$(dirname "$0")"

echo ""
echo "================================================"
echo "  Wysyłanie AI IDE do github.com/meganz331102-source/AI_IDE"
echo "================================================"
echo ""

REPO_URL="https://github.com/meganz331102-source/AI_IDE.git"

# Sprawdź czy git zainstalowany
if ! command -v git &> /dev/null; then
  echo "✗ Brak git. Zainstaluj Xcode CLT: xcode-select --install"
  exit 1
fi

# Token: spróbuj z Keychain (ten sam, który zapisała aplikacja), albo zapytaj
TOKEN=$(security find-generic-password -s "ai-ide-github" -a "github-pat" -w 2>/dev/null || true)

if [ -z "$TOKEN" ]; then
  echo "Wklej swój GitHub Personal Access Token (zakres: repo)."
  echo "Token wygenerujesz tutaj:"
  echo "  https://github.com/settings/tokens/new?scopes=repo&description=AI%20IDE"
  echo ""
  read -s -p "Token (znaki ukryte): " TOKEN
  echo ""
fi

if [ -z "$TOKEN" ]; then
  echo "✗ Brak tokenu. Anulowano."
  exit 1
fi

AUTH_URL="https://x-access-token:${TOKEN}@github.com/meganz331102-source/AI_IDE.git"

# Wyklucz to czego nie chcemy w repo
cat > .gitignore << 'IGN'
node_modules/
dist/
dist-electron/
release/
.DS_Store
*.log
.env
IGN

# Init repo jeśli go nie ma
if [ ! -d .git ]; then
  echo "Inicjalizuję git..."
  git init -q
  git checkout -b main -q 2>/dev/null || git checkout main -q 2>/dev/null || true
fi

# Konfiguracja autora (lokalnie dla tego repo, by nie ruszać globala)
git config user.email "ai-ide@local" 2>/dev/null
git config user.name "AI IDE" 2>/dev/null

# Remote
if git remote get-url origin &> /dev/null; then
  git remote set-url origin "$AUTH_URL"
else
  git remote add origin "$AUTH_URL"
fi

echo "Stage'uję pliki..."
git add -A
git commit -m "AI IDE v2.2.0 — preview window + element picker" -q || echo "(brak zmian do commitowania)"

echo "Pushuję na main (force, bo to mirror lokalnego stanu)..."
if git push -u origin main --force 2>&1; then
  echo ""
  echo "✓ Wysłano! Sprawdź: https://github.com/meganz331102-source/AI_IDE"
else
  echo ""
  echo "✗ Push się nie udał. Sprawdź czy token ma zakres 'repo' i czy repo istnieje."
fi

# Usuń token z remote (bezpieczeństwo)
git remote set-url origin "$REPO_URL"

echo ""
read -p "Naciśnij Enter, by zamknąć..."
