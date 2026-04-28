#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  Sabdia Equipment App — Local Dev Startup
#  Runs backend (FastAPI :8000) + frontend (Expo web :8081)
# ─────────────────────────────────────────────────────────────

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
section() { echo -e "\n${YELLOW}── $1 ──${NC}"; }

# ── 1. Homebrew ──────────────────────────────────────────────
section "Checking Homebrew"
if ! command -v brew &>/dev/null; then
  error "Homebrew not found. Install it first: https://brew.sh"
fi
info "Homebrew found"

# ── 2. MongoDB ───────────────────────────────────────────────
section "Checking MongoDB"
if ! brew list mongodb-community &>/dev/null 2>&1; then
  warn "MongoDB not installed — installing via Homebrew (this takes a minute)..."
  brew tap mongodb/brew
  brew install mongodb-community
  info "MongoDB installed"
else
  info "MongoDB already installed"
fi

# Start MongoDB if not running
if ! pgrep -x mongod &>/dev/null; then
  warn "Starting MongoDB..."
  brew services start mongodb-community
  sleep 2
  info "MongoDB started"
else
  info "MongoDB already running"
fi

# ── 3. Python / Backend ──────────────────────────────────────
section "Setting up Python backend"

if ! command -v python3 &>/dev/null; then
  error "Python 3 not found. Install via: brew install python"
fi

VENV_DIR="$BACKEND_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
  info "Creating Python virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

info "Installing Python dependencies..."
pip install -q -r "$BACKEND_DIR/requirements_local.txt"

info "Starting FastAPI backend on http://localhost:8000 ..."
cd "$BACKEND_DIR"
uvicorn server:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo $BACKEND_PID > /tmp/sabdia_backend.pid
deactivate

# Wait for backend to be ready
echo -n "  Waiting for backend"
for i in {1..20}; do
  if curl -s http://localhost:8000/docs &>/dev/null; then
    echo ""
    info "Backend is up at http://localhost:8000"
    break
  fi
  echo -n "."
  sleep 1
done

# ── 4. Node / Frontend ───────────────────────────────────────
section "Setting up Expo frontend"

if ! command -v node &>/dev/null; then
  error "Node.js not found. Install via: brew install node"
fi

# Check for yarn or npm
if command -v yarn &>/dev/null; then
  PKG_MGR="yarn"
else
  PKG_MGR="npx npm"
  warn "yarn not found, using npm"
fi

cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  info "Installing frontend dependencies (this takes a minute first time)..."
  if command -v yarn &>/dev/null; then
    yarn install
  else
    npm install
  fi
fi

info "Starting Expo web on http://localhost:8081 ..."
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Sabdia Equipment App — Starting!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Backend API:   ${YELLOW}http://localhost:8000${NC}"
echo -e "  API Docs:      ${YELLOW}http://localhost:8000/docs${NC}"
echo -e "  Frontend:      ${YELLOW}http://localhost:8081${NC}"
echo ""
echo -e "  Login:         naomi@sabdia.com / Admin123!"
echo -e "  Team login:    johnny@sabdia.com / Team123!"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Press Ctrl+C to stop everything"
echo ""

# Trap so we clean up backend on exit
cleanup() {
  echo ""
  warn "Shutting down..."
  kill $BACKEND_PID 2>/dev/null || true
  brew services stop mongodb-community 2>/dev/null || true
  info "Done. Goodbye!"
}
trap cleanup EXIT INT TERM

# Start Expo (web by default — no device needed)
if command -v yarn &>/dev/null; then
  yarn web
else
  npx expo start --web
fi
