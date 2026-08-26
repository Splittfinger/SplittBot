#!/bin/sh
set -eu

if [ "${1:-}" = "--version" ]; then
  echo "codex-cli deterministic-test-fixture"
  exit 0
fi

if [ -z "${SPLITTBOT_FAKE_NODE:-}" ] || [ -z "${SPLITTBOT_FAKE_APP_SERVER_PATH:-}" ]; then
  echo "The deterministic packaged runtime requires its explicit test environment." >&2
  exit 1
fi

exec "$SPLITTBOT_FAKE_NODE" "$SPLITTBOT_FAKE_APP_SERVER_PATH"
