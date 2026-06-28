#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE_PATH="$ROOT_DIR/systemd/lumina.service.template"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_PATH="$UNIT_DIR/lumina.service"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
USER_NAME="$(id -un)"
USER_UID="$(id -u)"
USER_BIN_DIR="$HOME/.local/bin"

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "Missing template: $TEMPLATE_PATH" >&2
  exit 1
fi

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Could not resolve an executable node binary." >&2
  exit 1
fi

mkdir -p "$UNIT_DIR"

sed \
  -e "s|__ROOT_DIR__|$ROOT_DIR|g" \
  -e "s|__NODE_BIN__|$NODE_BIN|g" \
  -e "s|__HOME_DIR__|$HOME|g" \
  -e "s|__USER_NAME__|$USER_NAME|g" \
  -e "s|__USER_UID__|$USER_UID|g" \
  -e "s|__USER_BIN_DIR__|$USER_BIN_DIR|g" \
  "$TEMPLATE_PATH" > "$UNIT_PATH"

systemctl --user daemon-reload
systemctl --user enable --now lumina.service

echo "Installed $UNIT_PATH"
echo "Lumina user service enabled and started."
