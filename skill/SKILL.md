---
name: ytdlp-mcp
description: "Use when the user shares media URLs, asks HOW yt-dlp works, wants bulk downloads with delays, or needs video re-encoded for social platforms. One call per action, full automation via inspect and queue."
version: 1.0.0
---

# ytdlp-mcp

Your AI downloads like yt-dlp thinks and edits like ffmpeg works. One server: probe any of 1300+ supported sites, download one file or a whole batch with polite delays, answer configuration questions, re-encode for the platform it will be posted on.

- VIEW (no download): `probe`, `formats`, `supported`, `inspect`, `search`
- DOWNLOAD (one action per call): `get_video`, `get_audio`, `get_subtitles`
- BULK (automation): `queue`, `fetch_all`, `watch`
- KNOWLEDGE (no download): `advise`
- CONVERT (transcode only): `convert`

## Routing: user intent to tool

| User says | Call | Then |
|---|---|---|
| "what is this video" / shares URL asking info | `probe` | Report title, duration, uploader, views |
| "what qualities are available" | `formats` | List rows, or `inspect` for the short answer |
| "can you download from this site" / unfamiliar URL | `supported` | If true, continue; if false, say the site is unsupported |
| "download this video" (no quality named) | `inspect`, then `get_video` with its quality | Ask 720p/1080p/best only when interactive and the user cares; otherwise use `inspect` output directly |
| "best quality" / "archive" | `get_video` quality `best` | No need to inspect first |
| "audio only" / "mp3" / "music" | `inspect` want `audio`, then `get_audio` | Default opus 64K; mp3/128K only on explicit request |
| "subtitles" / "transcript" / "captions" | `get_subtitles` lang `en` (or requested lang) | VTT file, manual subs preferred, auto fallback |
| Any URL, full automation, no questions | `inspect` | Execute its `action` + `quality` verbatim |
| "how do cookies work" / "what format selector" / any HOW question | `advise` | Answer from the tool, expand with preference advice |
| "compress this" / "convert for TikTok/IG/YouTube" | `convert` with `site` | Ask which platform first if unknown; preference decides the preset |
| "download these 10 videos" / batch URLs | `queue`, then `fetch_all` | Preview plans first, delay 3s default, per-URL results |
| "archive this channel" / "new videos weekly" | `watch`, then `fetch_all` on new ids | Flat list, no download until confirmed |

## Automation rule

`inspect` returns `{action, quality, available}`. In non-interactive runs, call `inspect` first and execute exactly what it returns. Never ask the user when `inspect` already answered.

## yt-dlp knowledge (advise the user with preferences, never guess)

- **Cookies:** export from a desktop browser with an extension (Get cookies.txt LOCALLY) as Netscape format, pass `--cookies cookies.txt` or set `YTDLP_COOKIES_FILE`. Never ask the user to paste cookie contents. Fixes login walls, age gates, private videos, TikTok IP blocks.
- **Format selectors:** `bv*+ba/b` is best video plus best audio merged. `bv*[height<=720]+ba/b[height<=720]/b` caps at 720p. `b` is a single progressive file (no merge, what TikTok serves). `best` grabs the largest single file. `--merge-output-format mp4` forces mp4 after merging.
- **Audio:** `-x --audio-format opus --audio-quality 64K` is smallest. mp3 needs ffmpeg and is bigger at equal quality; recommend mp3 128K only for compatibility (old players, WhatsApp). m4a keeps AAC without re-encoding when the source is AAC.
- **Subtitles:** `--write-subs` manual captions, `--write-auto-subs` auto-generated fallback, `--sub-langs en,id` picks languages, `--sub-format vtt/best` normalizes to VTT, `--skip-download` fetches captions without video.
- **Playlists:** default `--no-playlist` so one URL means one video. Opt in with `--yes-playlist`; `--flat-playlist` lists without downloading; `--download-archive FILE` skips fetched IDs across runs.
- **Network:** `--socket-timeout 20` avoids hangs, `--retries 3` handles flakes, `--proxy URL` routes traffic, `--sleep-requests 1` dodges rate limits, `--concurrent-fragments 4` speeds DASH.
- **ffmpeg:** required on PATH for merging and converting. Merge uses `--merge-output-format mp4`.
- **Output naming:** `-o "%(title).80s [%(id)s].%(ext)s"` keeps names short and unique. `--print after_move:filepath` reports the final path.

## Convert preferences (ask the user, then convert)

Codecs: h264 plays everywhere (default). hevc halves size at equal quality but encodes slower. vp9/av1 suit web. CRF 23 balanced; 20 sharper; 28 smaller. Platform presets applied automatically from `site`: TikTok/Reels h264 1080p max, YouTube h264 high-bitrate, X h264 720p. When the user names no platform, ask which one it is for before converting; the preset depends on their preference.

## Rules

1. One action per download call. Never combine video+audio+subtitles in one turn; call each tool separately.
2. Never set `allow_playlist: true` unless the user explicitly asks for a whole playlist or channel.
3. Keep `desc_chars` at 400 or lower; keep `formats` limit at 25 or lower.
4. Progressive single-file sources (TikTok) always resolve to `best` direct copy; tell the user no quality choice exists.

## Failure handling

Error payloads carry a `code` plus a `hint`:

| Code | Meaning | Action |
|---|---|---|
| `cookies_ip_block` | Site blocked the IP or needs login | Ask user for browser cookies (Netscape file), set `YTDLP_COOKIES_FILE`, retry once |
| `login_required` | Age gate, sign-in wall, private video | Same cookies fix |
| `unavailable` | Removed, deleted, geo-blocked | Try a different URL, do not retry |
| `unknown` | Anything else | Report in one sentence, retry at most once |

Never retry the same call more than once without changing arguments.
