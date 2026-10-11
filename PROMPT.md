# Copy this prompt to your AI

```text
Install the ytdlp MCP server from https://github.com/fanyzp/ytdlp-mcp
and let the AI do the rest:

1. Clone the repo.
2. Make sure `yt-dlp` and `ffmpeg` are on PATH. If either is missing,
   install it first (winget on Windows, brew on macOS, distro package
   on Linux) and stop if you cannot.
3. Run `npm run setup` and pick install targets in the checklist.
4. Verify: `hermes mcp list` shows ytdlp enabled (if Hermes is present).
5. Report which targets were installed.
```

One line version:

```text
Install https://github.com/fanyzp/ytdlp-mcp: clone, ensure yt-dlp and ffmpeg exist, run npm run setup, report results.
```
