#!/bin/bash
# CU.Setu API launcher.
#
# Guarantees the Flask backend starts even on a fresh sandbox container:
#   1. Prefers the vendored Flask inside ./vendor (ships with the project,
#      so no network access is needed at boot).
#   2. Falls back to installing requirements.txt if the vendored copy is
#      ever missing (e.g. cleaned by mistake).
#   3. Finally falls back to whatever Flask the system Python already has.
#
# The sandbox boot flow runs this automatically via:
#   bun run dev   ->   bash run.sh

cd "$(dirname "$0")"

if [ ! -d "vendor/flask" ]; then
    echo "[cu-setu-api] vendored Flask missing - installing from requirements.txt"
    python3 -m pip install --quiet --target vendor -r requirements.txt \
        || python3 -m pip install --quiet -r requirements.txt \
        || echo "[cu-setu-api] pip install failed - trying system Flask"
fi

# Vendored packages take priority; system site-packages stay as fallback.
export PYTHONPATH="$(pwd)/vendor${PYTHONPATH:+:$PYTHONPATH}"

echo "[cu-setu-api] starting Flask API on port ${CAMPUS_CONNECT_PORT:-5001}"
exec python3 app.py
