#!/usr/bin/env bash
set -euo pipefail

COMMAND="${1:-status}"
PORT="${2:-3000}"

require_bin() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

node_id() {
  python - <<'PY'
import json
import subprocess

payload = json.loads(subprocess.check_output(["tailscale", "status", "--json"]))
print((payload.get("Self") or {}).get("ID", ""))
PY
}

dns_name() {
  python - <<'PY'
import json
import subprocess

payload = json.loads(subprocess.check_output(["tailscale", "status", "--json"]))
name = ((payload.get("Self") or {}).get("DNSName") or "").rstrip(".")
print(name)
PY
}

ensure_local_app() {
  if ! curl -fsS "http://127.0.0.1:${PORT}" >/dev/null; then
    echo "Local app is not reachable on http://127.0.0.1:${PORT}" >&2
    exit 1
  fi
}

print_enable_hint() {
  local id
  id="$(node_id)"
  if [[ -n "$id" ]]; then
    echo "Enable Funnel for this node first:" >&2
    echo "https://login.tailscale.com/f/funnel?node=${id}" >&2
  fi
}

print_url_hint() {
  local name
  name="$(dns_name)"
  if [[ -n "$name" ]]; then
    echo "Public URL: https://${name}"
  fi
}

run_funnel_up() {
  python - "$PORT" <<'PY'
import subprocess
import sys

port = sys.argv[1]


def emit(stream, value):
    if not value:
        return
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    stream.write(value)

try:
    proc = subprocess.run(
        ["tailscale", "funnel", "--bg", "--yes", port],
        capture_output=True,
        text=True,
        timeout=15,
    )
except subprocess.TimeoutExpired as exc:
    combined = f"{exc.stdout or ''}\n{exc.stderr or ''}"
    emit(sys.stdout, exc.stdout)
    emit(sys.stderr, exc.stderr)
    if "Funnel is not enabled on your tailnet." in combined:
        sys.exit(2)
    sys.stderr.write("Timed out waiting for tailscale funnel to finish.\n")
    sys.exit(1)

emit(sys.stdout, proc.stdout)
emit(sys.stderr, proc.stderr)

combined = f"{proc.stdout}\n{proc.stderr}"
if "Funnel is not enabled on your tailnet." in combined:
    sys.exit(2)

if proc.returncode != 0:
    sys.exit(proc.returncode)
PY
}

require_bin tailscale
require_bin python
require_bin curl

case "$COMMAND" in
  up)
    ensure_local_app
    if run_funnel_up; then
      :
    else
      status=$?
      if [[ "$status" -ne 2 ]] && tailscale funnel status 2>&1 | grep -q "No serve config"; then
        print_enable_hint
      fi
      exit 1
    fi
    if tailscale funnel status 2>&1 | grep -q "No serve config"; then
      print_enable_hint
      exit 1
    fi
    print_url_hint
    tailscale funnel status
    ;;
  status)
    print_url_hint
    tailscale funnel status
    ;;
  down)
    tailscale funnel reset
    echo "Funnel disabled."
    ;;
  *)
    echo "Usage: $0 {up [port]|status|down}" >&2
    exit 1
    ;;
esac
