#!/bin/bash
# build-vsix.sh — compiles TypeScript and packages the extension as a .vsix

set -e

echo "📦 Kubiq — VSIX builder"
echo ""

# 1. Install dependencies
echo "→ Installing dependencies..."
npm install

# 2. Compile TypeScript
echo "→ Compiling TypeScript..."
npm run compile

# 3. Install vsce if not present
if ! command -v vsce &> /dev/null; then
  echo "→ Installing @vscode/vsce..."
  npm install -g @vscode/vsce
fi

# 4. Package
echo "→ Packaging extension..."
vsce package --no-dependencies

VSIX=$(ls *.vsix 2>/dev/null | head -1)
if [ -n "$VSIX" ]; then
  echo ""
  echo "✅ Done: $VSIX"
  echo ""
  echo "To install:"
  echo "  code --install-extension $VSIX"
  echo ""
  echo "Or in VS Code: Extensions → ··· → Install from VSIX..."
fi
