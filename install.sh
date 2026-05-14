#!/usr/bin/env bash
# 9router-sync installer for macOS and Linux.
#
# Run from a clone:    ./install.sh
# Run via curl:        curl -fsSL https://raw.githubusercontent.com/<owner>/9router-sync/main/install.sh | bash
#
# Env overrides:
#   PREFIX     install dir for the symlinked binary (default: ~/.local/bin, or /usr/local/bin if writable and on PATH)
#   APP_DIR    where the package lives  (default: ~/.9router-sync)
#   REPO_URL   git repo to clone if not running from a local checkout (default: https://github.com/ndrzk/9router-sync.git)
#   REF        git ref to check out                                   (default: main)

set -euo pipefail

# ---------- pretty printers --------------------------------------------------
if [ -t 1 ]; then
  C_DIM=$'\033[2m'; C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RESET=$'\033[0m'
else
  C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_RESET=""
fi
info()  { printf '%s>%s %s\n'   "$C_DIM"    "$C_RESET" "$*"; }
ok()    { printf '%s✓%s %s\n'   "$C_GREEN"  "$C_RESET" "$*"; }
warn()  { printf '%s!%s %s\n'   "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()   { printf '%s✗%s %s\n'   "$C_RED"    "$C_RESET" "$*" >&2; exit 1; }

# ---------- platform check ---------------------------------------------------
case "$(uname -s)" in
  Darwin|Linux) ;;
  *) die "unsupported OS: $(uname -s) (only macOS and Linux are supported)";;
esac

command -v node >/dev/null 2>&1 || die "node not found in PATH (need Node.js >= 18)"

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 18 ] || die "node $(node -v) too old (need >= 18)"

if ! command -v npm >/dev/null 2>&1; then
  die "npm not found in PATH"
fi

# ---------- where to install -------------------------------------------------
APP_DIR=${APP_DIR:-"$HOME/.9router-sync"}

pick_prefix() {
  if [ -n "${PREFIX:-}" ]; then
    printf '%s' "$PREFIX"; return
  fi
  case ":$PATH:" in
    *":$HOME/.local/bin:"*)
      printf '%s' "$HOME/.local/bin"; return ;;
    *":$HOME/bin:"*)
      printf '%s' "$HOME/bin"; return ;;
  esac
  if [ -w /usr/local/bin ]; then
    printf '%s' "/usr/local/bin"; return
  fi
  printf '%s' "$HOME/.local/bin"
}
PREFIX=$(pick_prefix)
mkdir -p "$PREFIX"

# ---------- locate sources (local checkout vs remote clone) -----------------
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")" >/dev/null 2>&1 && pwd -P || true)

REPO_URL=${REPO_URL:-"https://github.com/ndrzk/9router-sync.git"}
REF=${REF:-main}

if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/package.json" ] && [ -f "$SCRIPT_DIR/bin/9router-sync" ]; then
  SOURCE_DIR=$SCRIPT_DIR
  info "using local checkout at $SOURCE_DIR"
else
  command -v git >/dev/null 2>&1 || die "git not found; needed to fetch $REPO_URL"
  TMPDIR_CLONE=$(mktemp -d)
  trap 'rm -rf "$TMPDIR_CLONE"' EXIT
  info "cloning $REPO_URL ($REF) into a temp dir"
  git clone --depth 1 --branch "$REF" "$REPO_URL" "$TMPDIR_CLONE/repo" >/dev/null
  SOURCE_DIR=$TMPDIR_CLONE/repo
fi

# ---------- copy + install dependencies --------------------------------------
info "installing into $APP_DIR"
mkdir -p "$APP_DIR"

# Mirror only the files we ship (matches `files` in package.json).
for entry in bin lib package.json README.md LICENSE uninstall.sh; do
  [ -e "$SOURCE_DIR/$entry" ] || continue
  rm -rf "$APP_DIR/$entry"
  cp -R "$SOURCE_DIR/$entry" "$APP_DIR/"
done

(
  cd "$APP_DIR"
  info "installing better-sqlite3 (this compiles a native module)"
  npm install --omit=dev --no-audit --no-fund --silent
)

chmod +x "$APP_DIR/bin/9router-sync"

# ---------- symlink ----------------------------------------------------------
LINK="$PREFIX/9router-sync"
ln -sf "$APP_DIR/bin/9router-sync" "$LINK"
ok "linked $LINK -> $APP_DIR/bin/9router-sync"

# ---------- verify -----------------------------------------------------------
if "$LINK" --help >/dev/null 2>&1; then
  ok "9router-sync installed"
else
  die "installed binary failed to run; try: $LINK --help"
fi

case ":$PATH:" in
  *":$PREFIX:"*) : ;;
  *)
    warn "$PREFIX is not on your PATH"
    warn "add this to your shell rc:"
    warn "  export PATH=\"$PREFIX:\$PATH\""
    ;;
esac

cat <<EOF

Next steps:
  1. 9router-sync --init              # print config template + Supabase SQL
  2. save it to ~/.9router/sync.json with your supabaseUrl + supabaseKey
  3. run the printed SQL in Supabase
  4. 9router-sync                     # merge both directions

To uninstall:
  rm "$LINK" && rm -rf "$APP_DIR"
EOF
