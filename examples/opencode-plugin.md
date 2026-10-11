# OpenCode plugin (project or global)

Copy the plugin file into your OpenCode plugins directory:

```bash
# Global
mkdir -p ~/.config/opencode/plugins
cp /path/to/ytdlp-mcp/plugin/ytdlp.ts ~/.config/opencode/plugins/

# Project-level
mkdir -p .opencode/plugins
cp /path/to/ytdlp-mcp/plugin/ytdlp.ts .opencode/plugins/
```

Set the repo path so the plugin finds the server:

```bash
export YTDLP_MCP_ENTRY=/path/to/ytdlp-mcp/src/index.js
```

Or let the installer do it:

```bash
node scripts/install.mjs --only=opencode-plugin
```
