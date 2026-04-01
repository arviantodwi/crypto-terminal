#!/usr/bin/env bash
# seed.sh — streams candle data from POST /ohlc/seed and renders a progress bar.
#
# Dependencies: curl, jq
#
# Usage:
#   bash scripts/seed.sh -f                 # forward fill only
#   bash scripts/seed.sh -n 500000          # backward fill to 500k candles
#   bash scripts/seed.sh -f -n 500000       # forward fill, then backward fill
#   INSTRUMENT=ETHUSDT bash scripts/seed.sh -f -n 500000
#
# Environment variables:
#   BASE_URL    (default: http://localhost:3002)
#   INSTRUMENT  (default: BTCUSDT)
#   AGGREGATE   (default: 5)

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3002}"
INSTRUMENT="${INSTRUMENT:-BTCUSDT}"
AGGREGATE="${AGGREGATE:-5}"

FORWARD_FILL=false
NUMBERS=""

# ── Parse flags ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--forward-fill)
      FORWARD_FILL=true
      shift
      ;;
    -n|--numbers)
      if [[ -z "${2:-}" ]]; then
        echo "✗ -n/--numbers requires a value" >&2
        exit 1
      fi
      NUMBERS="$2"
      shift 2
      ;;
    -*)
      echo "✗ Unknown flag: $1" >&2
      exit 1
      ;;
    *)
      shift
      ;;
  esac
done

if [[ "$FORWARD_FILL" == "false" && -z "$NUMBERS" ]]; then
  echo "✗ At least one of -f/--forward-fill or -n/--numbers must be provided." >&2
  echo ""
  echo "Usage:"
  echo "  bash scripts/seed.sh -f                 # forward fill only"
  echo "  bash scripts/seed.sh -n 500000          # backward fill to 500k candles"
  echo "  bash scripts/seed.sh -f -n 500000       # forward fill, then backward fill"
  exit 1
fi

# ── Terminal width ────────────────────────────────────────────────────────────
TERM_WIDTH=$(tput cols 2>/dev/null || echo 80)
BAR_WIDTH=$((TERM_WIDTH - 50))
[[ $BAR_WIDTH -lt 10 ]] && BAR_WIDTH=10

# ── Build request body ────────────────────────────────────────────────────────
REQUEST_BODY=$(jq -n \
  --arg instrument "$INSTRUMENT" \
  --argjson aggregate "$AGGREGATE" \
  '{instrument: $instrument, aggregate: $aggregate}')
[[ "$FORWARD_FILL" == "true" ]] && REQUEST_BODY=$(printf '%s' "$REQUEST_BODY" | jq '. + {forward_fill: true}')
[[ -n "$NUMBERS" ]] && REQUEST_BODY=$(printf '%s' "$REQUEST_BODY" | jq --argjson n "$NUMBERS" '. + {numbers: $n}')

# ── Helpers ───────────────────────────────────────────────────────────────────
fmt_num() {
  printf "%'d" "$1" 2>/dev/null || echo "$1"
}

render_bar() {
  local filled="$1"
  local total="$2"
  local fill_count=0
  if [[ "$total" -gt 0 ]]; then
    fill_count=$(( BAR_WIDTH * filled / total ))
  fi
  [[ $fill_count -gt $BAR_WIDTH ]] && fill_count=$BAR_WIDTH
  local empty_count=$(( BAR_WIDTH - fill_count ))
  local bar=""
  local i
  for (( i=0; i<fill_count; i++ )); do bar="${bar}█"; done
  for (( i=0; i<empty_count; i++ )); do bar="${bar}░"; done
  printf '%s' "$bar"
}

# ── Stream and process ────────────────────────────────────────────────────────
http_status=""
NEWLINE_NEEDED=false
EXIT_CODE=0

CURL_EXIT_FILE=$(mktemp)
trap 'rm -f "$CURL_EXIT_FILE"' EXIT

while IFS= read -r line; do
  # HTTP status sentinel (appended by curl -w)
  if [[ "$line" == __HTTPSTATUS__* ]]; then
    http_status="${line#__HTTPSTATUS__}"
    continue
  fi

  [[ -z "$line" ]] && continue

  # Parse status fields
  status_field=$(jq -r '.status // empty' <<< "$line" 2>/dev/null || true)
  status_code_field=$(jq -r 'if has("statusCode") then .statusCode | tostring else empty end' <<< "$line" 2>/dev/null || true)

  # Pre-flight error response (400/409 — non-streaming JSON body)
  if [[ -n "$status_code_field" ]]; then
    msg=$(jq -r '.message // "Unknown error"' <<< "$line" 2>/dev/null || echo "Unknown error")
    [[ "$NEWLINE_NEEDED" == "true" ]] && { echo ""; NEWLINE_NEEDED=false; }
    echo "✗ $msg" >&2
    EXIT_CODE=1
    continue
  fi

  case "$status_field" in
    notification)
      msg=$(jq -r '.message' <<< "$line" 2>/dev/null || echo "")
      echo "ℹ $msg"
      ;;

    progress)
      phase=$(jq -r '.phase' <<< "$line" 2>/dev/null || echo "")
      page=$(jq -r '.page' <<< "$line" 2>/dev/null || echo "0")
      total_pages=$(jq -r '.total_pages' <<< "$line" 2>/dev/null || echo "0")
      inserted=$(jq -r '.inserted' <<< "$line" 2>/dev/null || echo "0")
      skipped=$(jq -r '.skipped' <<< "$line" 2>/dev/null || echo "0")
      rl=$(jq -r '.ratelimit_remaining // "N/A"' <<< "$line" 2>/dev/null || echo "N/A")

      if [[ "$phase" == "forward_fill" ]]; then
        label="Forward "
      else
        label="Backward"
      fi

      bar=$(render_bar "$page" "$total_pages")
      printf "\r[%s] [%s] %d/%-6d ins: %-6d skip: %-4d rl: %s" \
        "$label" "$bar" "$page" "$total_pages" "$inserted" "$skipped" "$rl"
      NEWLINE_NEEDED=true
      ;;

    phase_complete)
      phase=$(jq -r '.phase' <<< "$line" 2>/dev/null || echo "")
      ins=$(jq -r '.inserted' <<< "$line" 2>/dev/null || echo "0")
      skip=$(jq -r '.skipped' <<< "$line" 2>/dev/null || echo "0")

      echo ""
      NEWLINE_NEEDED=false

      if [[ "$phase" == "forward_fill" ]]; then
        phase_label="Forward fill"
      else
        phase_label="Backward fill"
      fi

      echo "✓ $phase_label complete: $(fmt_num "$ins") inserted, $(fmt_num "$skip") skipped"
      ;;

    done)
      total_inserted=$(jq -r '.total_inserted' <<< "$line" 2>/dev/null || echo "0")
      total_skipped=$(jq -r '.total_skipped' <<< "$line" 2>/dev/null || echo "0")
      duration_ms=$(jq -r '.duration_ms' <<< "$line" 2>/dev/null || echo "0")

      [[ "$NEWLINE_NEEDED" == "true" ]] && { echo ""; NEWLINE_NEEDED=false; }

      dur_s=$(( duration_ms / 1000 ))
      dur_dec=$(( (duration_ms % 1000) / 100 ))

      echo "✓ Done: $(fmt_num "$total_inserted") inserted, $(fmt_num "$total_skipped") skipped in ${dur_s}.${dur_dec}s"
      ;;

    error)
      phase=$(jq -r '.phase' <<< "$line" 2>/dev/null || echo "unknown")
      page=$(jq -r '.page' <<< "$line" 2>/dev/null || echo "0")
      msg=$(jq -r '.message' <<< "$line" 2>/dev/null || echo "Unknown error")

      [[ "$NEWLINE_NEEDED" == "true" ]] && { echo ""; NEWLINE_NEEDED=false; }
      echo "✗ Failed on ${phase} page ${page}: $msg" >&2
      EXIT_CODE=1
      ;;
  esac

done < <(
  curl --no-buffer \
    -s \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY" \
    -w "\n__HTTPSTATUS__%{http_code}" \
    "$BASE_URL/ohlc/seed" 2>/dev/null
  echo "$?" > "$CURL_EXIT_FILE"
)

# ── Post-loop checks ──────────────────────────────────────────────────────────
curl_exit=$(cat "$CURL_EXIT_FILE" 2>/dev/null || echo "1")

if [[ -z "$http_status" || "$curl_exit" != "0" ]]; then
  [[ "$NEWLINE_NEEDED" == "true" ]] && echo ""
  echo "✗ Could not connect to candle-collector at $BASE_URL" >&2
  exit 1
fi

exit "$EXIT_CODE"
