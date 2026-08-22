#!/usr/bin/env bash
#
# verify-no-mock.sh — release gate for Corolary.
#
# WHY THIS EXISTS: a previous submission by this team failed to reach the finals
# because mock data shipped in the demo. For a product whose entire thesis is
# "these numbers cannot be fabricated", a single fabricated number on screen is
# not a rough edge — it is a contradiction of the pitch. This gate is a hard
# blocker, not a lint suggestion.
#
# Run before: recording the demo video, deploying the dashboard, submitting.
#   bash tools/verify-no-mock.sh
#
# Exit 0 = clean. Exit 1 = do not ship.
#
# Rules enforced (see CLAUDE.md "PRODUK FINAL: NOL MOCK"):
#   1. No component imports from src/mocks/ — only src/data/source.ts may.
#   2. src/mocks/ is gone from the tree by Fase 6c.
#   3. No production env file selects the mock data source.
#   4. No hardcoded contract addresses (they come from deployments/*.json).
#   5. No dead UI: "coming soon" / TODO placeholders in shipped components.
#   6. No silent mock fallback in error paths.
#   7. Production bundle contains no mock artifacts.
#
# NOT violations, deliberately not flagged:
#   - vm.etch precompile mocks in packages/contracts/test/** (test-only)
#   - real Ethereum tx fixtures (frozen real data, not mock)

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/packages/web"
FAIL=0

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$*"; }

fail() { red   "  FAIL  $*"; FAIL=1; }
pass() { grn   "  ok    $*"; }
skip() { ylw   "  skip  $*"; }

echo "verify-no-mock — Corolary release gate"
echo "root: $ROOT"
echo

if [ ! -d "$WEB" ]; then
  skip "packages/web does not exist yet — nothing to verify"
  echo
  grn "PASS (frontend not started)"
  exit 0
fi

SRC="$WEB/src"

# --- 1. mock imports outside the single data entry point -----------------------
echo "[1] mock imports confined to src/data/source.ts"
if [ -d "$SRC" ]; then
  hits=$(grep -rn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
           -E "from ['\"][^'\"]*mocks?/" "$SRC" 2>/dev/null \
         | grep -v '^.*/src/data/source\.ts:' || true)
  if [ -n "$hits" ]; then
    fail "component(s) import mocks directly:"
    echo "$hits" | sed 's/^/          /'
  else
    pass "no direct mock imports"
  fi
else
  skip "no src/ yet"
fi

# --- 2. mocks directory removed at release ------------------------------------
echo "[2] src/mocks/ removed from tree"
if [ -d "$SRC/mocks" ]; then
  fail "src/mocks/ still present — Fase 6c requires deletion, not just disuse"
else
  pass "src/mocks/ absent"
fi

# --- 3. no env file selects the mock source -----------------------------------
echo "[3] data source is 'chain' everywhere"
# Next.js (spec §11) uses NEXT_PUBLIC_*; the Vite name is accepted too in case the
# frontend switches build tools — the mechanism is identical either way.
envhits=$(grep -rnE "NEXT_PUBLIC_DATA_SOURCE|VITE_DATA_SOURCE" "$WEB" \
            --include='.env*' --include='*.env' --include='*.yml' --include='*.yaml' \
            --include='*.json' --include='Dockerfile*' 2>/dev/null \
          | grep -vi "=chain" || true)
if [ -n "$envhits" ]; then
  fail "non-chain data source configured:"
  echo "$envhits" | sed 's/^/          /'
else
  pass "no mock data source configured"
fi

# --- 4. no hardcoded contract addresses ---------------------------------------
echo "[4] contract addresses read from deployments/*.json"
addrhits=$(grep -rnE "['\"]0x[a-fA-F0-9]{40}['\"]" "$SRC" \
             --include='*.ts' --include='*.tsx' 2>/dev/null \
           | grep -viE "0x0{40}|test|spec|\.d\.ts" || true)
if [ -n "$addrhits" ]; then
  fail "hardcoded address literal(s) in src/:"
  echo "$addrhits" | sed 's/^/          /'
else
  pass "no hardcoded addresses"
fi

# --- 5. no dead UI ------------------------------------------------------------
echo "[5] no placeholder / dead UI"
deadhits=$(grep -rniE "coming soon|segera hadir|not implemented|belum tersedia|lorem ipsum|placeholder" "$SRC" \
             --include='*.ts' --include='*.tsx' --include='*.css' 2>/dev/null \
           | grep -viE "placeholder=|placeholder:|::placeholder|placeholderData" || true)
if [ -n "$deadhits" ]; then
  fail "placeholder UI text found — delete the feature, don't label it:"
  echo "$deadhits" | sed 's/^/          /'
else
  pass "no placeholder UI"
fi

# --- 6. no silent fallback to mock in error paths -----------------------------
echo "[6] no mock fallback on RPC failure"
fbhits=$(grep -rniE "catch[^}]{0,200}(mock|fallbackData|sampleData|demoData)" "$SRC" \
           --include='*.ts' --include='*.tsx' 2>/dev/null || true)
if [ -n "$fbhits" ]; then
  fail "possible mock fallback in an error path — RPC failure must surface as an error:"
  echo "$fbhits" | sed 's/^/          /'
else
  pass "no mock fallback detected"
fi

# --- 7. production bundle clean ------------------------------------------------
echo "[7] production bundle free of mock artifacts"
DIST=""
for d in "$WEB/dist" "$WEB/build" "$WEB/.next"; do
  [ -d "$d" ] && DIST="$d" && break
done
if [ -z "$DIST" ]; then
  skip "no build output found — run the production build, then re-run this gate"
else
  bhits=$(grep -rlniE "state\.json|feed\.json|DATA_SOURCE=?[\"']?mock|__MOCK__" "$DIST" 2>/dev/null || true)
  if [ -n "$bhits" ]; then
    fail "mock artifacts present in $DIST:"
    echo "$bhits" | sed 's/^/          /'
  else
    pass "bundle clean ($DIST)"
  fi
fi

echo
if [ "$FAIL" -eq 0 ]; then
  grn "PASS — safe to record, deploy, and submit."
  echo
  echo "Automated checks cannot see everything. Still verify by hand (Fase 6c):"
  echo "  - kill the RPC endpoint: the dashboard must show an honest error, not stale numbers"
  echo "  - open 5 random feed links: every Etherscan + Blockscout link must resolve"
  echo "  - the FROZEN state was reached by a real Sepolia withdrawal, not staged"
  echo "  - the attack panel calls a real mint() and shows the node's own revert"
  echo "  - every number on screen traces to an eth_call / eth_getLogs in DevTools"
  exit 0
else
  red "FAIL — do not record, deploy, or submit until these are clean."
  exit 1
fi
