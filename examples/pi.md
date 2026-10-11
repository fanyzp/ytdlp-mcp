# Pi agent (`~/.pi/agent/skills`)

Pi reads skills from `~/.pi/agent/skills/`. No MCP server config needed.

```bash
mkdir -p ~/.pi/agent/skills
ln -s /path/to/ytdlp-mcp/skill ~/.pi/agent/skills/ytdlp-mcp
```

Or let the installer do it:

```bash
node scripts/install.mjs --only=pi
```
