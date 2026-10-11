# Cursor (`~/.cursor/mcp.json`) / Copilot CLI (`~/.copilot/mcp-config.json`)

```json
{ "mcpServers": { "ytdlp": {
  "command": "node",
  "args": ["/path/to/ytdlp-mcp/src/index.js"],
  "env": { "YTDLP_DOWNLOAD_DIR": "/path/to/downloads" }
} } }
```

Or let the installer do it:

```bash
node scripts/install.mjs --only=cursor,copilot
```
