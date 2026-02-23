#!/usr/bin/env bash
set -euo pipefail

APP_NAME="CurrentScope"
INSTALL_DIR="$HOME/.local/share/$APP_NAME"
BIN_DIR="$HOME/.local/bin"

SOURCE="${1:-}"
if [ -z "$SOURCE" ]; then
  if [ -f "CurrentScope.AppImage" ]; then
    SOURCE="CurrentScope.AppImage"
  elif [ -f "NewsApp.AppImage" ]; then
    SOURCE="NewsApp.AppImage"
  fi
fi

if [ -z "$SOURCE" ]; then
  echo "Usage: ./install-linux.sh <path-or-url-to-AppImage>"
  echo ""
  echo "Place CurrentScope.AppImage in this folder or pass a URL."
  exit 1
fi

mkdir -p "$INSTALL_DIR" "$BIN_DIR"

if [[ "$SOURCE" =~ ^https?:// ]]; then
  echo "Downloading $SOURCE..."
  curl -L --fail --output "$INSTALL_DIR/$APP_NAME.AppImage" "$SOURCE"
else
  cp "$SOURCE" "$INSTALL_DIR/$APP_NAME.AppImage"
fi

chmod +x "$INSTALL_DIR/$APP_NAME.AppImage"
ln -sf "$INSTALL_DIR/$APP_NAME.AppImage" "$BIN_DIR/$APP_NAME"

echo "Installed. Run with: $APP_NAME"
