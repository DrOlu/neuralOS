#!/usr/bin/env bash
# Deprecation hygiene for the `neuralos` name on npm.
#
# HISTORY: the npm name previously held the RTerm backend daemon (2.8.0 … 3.9.5).
# Those versions ARE the daemon, so their "use rterm-backend instead" notice is
# correct and stays. 3.9.5 accidentally carries the message "test" and 3.9.6 is
# the first foundation-model runtime on this name (clean).
#
# RUN THIS AFTER publishing the next release (e.g. 3.10.0):
#   npm deprecate "neuralos@<3.10.0" "This version is the RTerm backend daemon - use rterm-backend instead; neuralos is the neuralOS foundation-model runtime." # sets/keeps the daemon notice
#
# What we actually need:
#   1. fix the junk message on 3.9.5
#   2. point the runtime-era version at the current release
#
# Requires an npm token with publish rights:  npm login --auth-type=legacy
set -euo pipefail
: "${NEW_VERSION:=3.10.0}"
DAEMON_MSG="This version is the RTerm backend daemon - use rterm-backend instead. neuralos is now the neuralOS foundation-model runtime (offline tool-calling, structured extraction and embeddings)."

echo "== 1. repair the accidental 'test' notice on 3.9.5 =="
npm deprecate "neuralos@3.9.5" "$DAEMON_MSG"

echo "== 2. keep the daemon notice on the daemon line (2.8.0 - 3.9.4) — no change needed =="
echo "   (91 versions already carry it; verify with: npm view neuralos@3.9.4 deprecated)"

echo "== 3. once $NEW_VERSION is published, point the previous runtime version forward =="
echo "   npm deprecate \"neuralos@3.9.6\" \"Superseded by $NEW_VERSION — the version-parity release ('npm install neuralos@$NEW_VERSION').\""
echo
echo "Run step 3 only after the release lands, so nobody is told to upgrade to a version that does not exist."
