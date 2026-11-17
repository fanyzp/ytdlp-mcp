# Publishing and positioning — ytdlp-mcp

Owner: **fanyzp** only. All listings, npm, and registry entries use this identity.

Current release: `@fanyzp/ytdlp-mcp@1.0.0` (scoped name, because npm rejected the unscoped name as too similar to the existing `yt-dlp-mcp` package) — 13 tools, tests 5/5 passing (17 Nov 2026)
Registry name: `io.github.fanyzp/ytdlp-mcp`

## Why this one can stand out in a crowded category

There are 40+ YouTube / yt-dlp MCP servers. The leaders are narrow:

| Server | Focus | Gap |
| --- | --- | --- |
| kevinwatt/yt-dlp-mcp | Download, metadata, transcript (local stdio) | No batch, no convert, no automation planning |
| anaisbetts/mcp-youtube (~490 stars) | Subtitles/transcript into Claude only | Transcript only, no download |
| jkawamoto/mcp-youtube-transcript | Transcript only, Python | Transcript only |
| TubePull | Hosted remote, 3 downloads/day free, then paid | Hosted and paid; not local/free/full |

ytdlp-mcp (this repo) is already broader than all of the local ones:

- **Inspect-first automation:** `inspect` returns `{action, quality, available}` and
  the agent executes it verbatim. No other yt-dlp MCP plans the download for the agent.
- **Batch as a first-class flow:** `queue` previews a plan for many URLs, `fetch_all`
  downloads with polite delays, `watch` lists a playlist/channel without downloading.
- **Convert for the destination platform:** `convert` applies FFmpeg presets for
  TikTok/Reels, YouTube and X. Download-only servers stop at the file; this one
  finishes the job for creators.
- **Knowledge built in:** `advise` answers yt-dlp configuration questions (cookies,
  format selectors, subtitles, playlists) from curated knowledge, not guesses.
- **Search that is verified, not claimed:** YouTube and SoundCloud only, because those
  prefixes were tested against a real yt-dlp build.
- **1300+ sites, not just YouTube:** every tool works on any yt-dlp extractor.
- **Slash command and skill included:** `/ytdlp-mcp` in OpenCode, Gemini CLI and
  Claude Code, plus an Agent Skill and copy-paste configs for 9 clients in `examples/`.

Positioning line for every listing:

> yt-dlp for AI agents, end to end: inspect a link, download video or audio from
> 1300+ sites, batch a whole list, fetch subtitles, and convert the result for
> TikTok, Reels, YouTube or X — in plain language, one MCP server.

## Roadmap to widen the gap (v1.1, proposed — not built yet)

1. **`transcript` tool (highest viral value).** Today `get_subtitles` saves a VTT
   file. The most-starred competitor exists only to put transcript text into the
   agent's context. Add `transcript`: fetch subtitles, strip VTT timing/duplicates,
   return clean text inline (with a `max_chars` cap). This makes the server useful
   for summarise/research workflows, not only downloading.
2. **`thumbnail` / frame grab.** Return a thumbnail URL from `probe` already exists;
   add a tool that downloads the thumbnail or a frame at a timestamp via FFmpeg,
   for agents that need an image to describe or post.
3. **README demo GIF/video.** A 20-second terminal/agent capture of
   “download this as 720p MP4” → file, plus the TikTok convert flow. Listings with
   a demo convert far better on Glama/Smithery/Reddit.
4. Keep scope discipline: do not add a hosted/remote version. Local, free and
   full-featured is the contrast against paid hosted options.

## Files prepared for publishing

| File | Purpose |
| --- | --- |
| `package.json` | `mcpName` added, author/homepage/bugs added, keywords expanded, `files` includes the manifests below |
| `server.json` | Official MCP Registry manifest (schema 2025-12-11), validated with `mcp-publisher validate` |
| `smithery.yaml` | Smithery stdio start command + config schema (download dir, cookies, binaries) |
| `glama.json` | Glama maintainer claim (`fanyzp`) |
| `.github/workflows/publish-mcp-registry.yml` | Manual-only registry publish via GitHub OIDC. No auto build, per owner rule. |

## Publish order — same as the Instagram MCP

1. `npm test` and `npm pack --dry-run` (check tests are excluded, manifests included)
2. Commit and push to `fanyzp/ytdlp-mcp` with a Conventional Commit, after owner QC.
   Set GitHub topics: `mcp`, `mcp-server`, `model-context-protocol`, `yt-dlp`,
   `youtube`, `video-downloader`, `ffmpeg`, `ai-agent`
3. `npm publish --access public` with the stored npm token (connector custom.npm)
4. Official MCP Registry: `mcp-publisher login github` then `mcp-publisher publish`,
   or run the manual GitHub Actions workflow.
5. Smithery at https://smithery.ai/new with the GitHub URL; claim Glama listing;
   verify PulseMCP / mcp.directory auto-sync; free form at mcpservers.org;
   PR to awesome-mcp-servers.
6. Skip paid listings (mcp.so, MCP Market) until free channels prove demand.

## Honest limits for listings

- Requires `yt-dlp` and `ffmpeg` installed locally (or `YTDLP_BIN` / `FFMPEG_BIN`).
  State this up front; it is the main install friction versus hosted servers.
- Some sites block datacenter IPs or require cookies. The error codes already
  carry hints (`cookies_ip_block`, `login_required`, `unavailable`); keep that
  wording in listings instead of promising every site always works.
