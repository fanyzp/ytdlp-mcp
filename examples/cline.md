# Cline (skills only)

Cline reads skills but manages MCP servers through its own UI. Link the skill:

```bash
mkdir -p ~/.cline/skills
ln -s /path/to/ytdlp-mcp/skill ~/.cline/skills/ytdlp-mcp
```

Then add the server manually in Cline MCP settings:

- command: `node`
- args: `/path/to/ytdlp-mcp/src/index.js`

Or let the installer link the skill:

```bash
node scripts/install.mjs --only=cline
```
