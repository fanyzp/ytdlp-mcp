#!/usr/bin/env bash
# Hermes Agent: register ytdlp MCP server.
# Usage: YTDLP_MCP_DIR=/path/to/ytdlp-mcp bash hermes.sh
set -euo pipefail
DIR="${YTDLP_MCP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
hermes mcp add ytdlp --command node --args "$DIR/src/index.js"
