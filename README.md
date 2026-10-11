
<p align="center">
  <a href="assets/banner.png">
    <img src="assets/banner.png" alt="ytdlp-mcp" width="100%">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/version-v1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node.js">
  <img src="https://img.shields.io/badge/platforms-linux_macos_windows-lightgrey" alt="Platforms">
</p>

<p align="center">
  <strong>An MCP server that lets AI agents inspect, download, and convert video and audio using yt-dlp and FFmpeg through natural language instructions.</strong>
</p>

## Example

Send a link, get the file. Or type `/ytdlp-mcp` in OpenCode, Gemini CLI, or Claude Code:

![chat](assets/chat.png)

## Install

```bash
git clone https://github.com/fanyzp/ytdlp-mcp.git && cd ytdlp-mcp && npm run setup
```

Requires `yt-dlp`, `ffmpeg`, Node 18. Or copy [PROMPT.md](PROMPT.md) into any AI agent and let it install for you.

## Tools

| Tool | What it does |
|---|---|
| `probe` | Video metadata: title, duration, uploader, views |
| `formats` | Available qualities and sizes |
| `supported` | Check if a URL's site is supported |
| `inspect` | Plan: action + quality + available list |
| `get_video` | Download video to mp4 |
| `get_audio` | Download audio only |
| `get_subtitles` | Download subtitles to VTT |
| `queue` | Plan a batch of URLs with delays |
| `fetch_all` | Download a batch with per-URL results |
| `watch` | List playlist or channel entries |
| `advise` | Answer yt-dlp config questions |
| `convert` | Re-encode video with ffmpeg |

## Env

| Variable | Default |
|---|---|
| `YTDLP_DOWNLOAD_DIR` | `~/Downloads/ytdlp-mcp` |
| `YTDLP_COOKIES_FILE` | empty |
| `YTDLP_BIN` / `FFMPEG_BIN` | `yt-dlp` / `ffmpeg` |

## License

MIT: [LICENSE](LICENSE)
