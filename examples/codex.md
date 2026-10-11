# Codex CLI (`~/.codex/config.toml`)

```toml
[mcp_servers.ytdlp]
command = "node"
args = ["/path/to/ytdlp-mcp/src/index.js"]
[mcp_servers.ytdlp.env]
YTDLP_DOWNLOAD_DIR = "/path/to/downloads"
```

Or let the installer do it:

```bash
node scripts/install.mjs --only=codex
```
