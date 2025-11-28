#!/bin/sh
set -e

HOOKS_DIR=".git/hooks"
if [ ! -d "$HOOKS_DIR" ]; then
  echo ".git/hooks not found. Run this from the repository root." >&2
  exit 1
fi

cp scripts/pre-push "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/pre-push"
echo "Installed pre-push hook to $HOOKS_DIR/pre-push"
