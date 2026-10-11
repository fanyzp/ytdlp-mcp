import { homedir } from "node:os";
import { join } from "node:path";

export const VERSION = "1.0.0";

export const HEIGHT_CAP = { "360p": 360, "480p": 480, "720p": 720, "1080p": 1080 };

export function defaultDir() {
  return process.env.YTDLP_DOWNLOAD_DIR || join(homedir(), "Downloads", "ytdlp-mcp");
}

export function baseArgs(extra = [], cookies = "") {
  const a = ["--no-warnings"];
  if (cookies) a.push("--cookies", cookies);
  return a.concat(extra);
}

export function videoSelector(cap) {
  return `bv*[height<=${cap}]+ba/b[height<=${cap}]/b`;
}

export function compactFormats(info, limit = 25) {
  const rows = (info.formats || [])
    .filter((f) => f.format_id && f.format_id !== "sb0")
    .map((f) => {
      const exact = f.filesize != null;
      const bytes = exact ? f.filesize : f.filesize_approx;
      return {
        id: f.format_id,
        ext: f.ext,
        res: f.resolution || (f.height ? `${f.width || "?"}x${f.height}` : "audio"),
        height: f.height || 0,
        fps: f.fps || null,
        vcodec: f.vcodec || null,
        acodec: f.acodec || null,
        tbr: f.tbr ? Math.round(f.tbr) : null,
        size_mb: bytes != null ? Math.round((bytes / 1048576) * 10) / 10 : null,
        size_approx: bytes != null ? !exact : false,
        proto: f.protocol || null,
        note: (f.format_note || "").slice(0, 40) || null,
      };
    })
    .sort((x, y) => y.height - x.height || (y.tbr || 0) - (x.tbr || 0));
  return rows.slice(0, limit);
}

export function ytdlpCommand(envBin, fallback = "yt-dlp") {
  return { bin: envBin || fallback };
}

export function isFilePath(line = "") {
  const l = String(line).trim();
  if (!l || l.startsWith("[")) return false;
  return l.startsWith("/") || /^[A-Za-z]:[\\/]/.test(l) || l.startsWith("\\\\");
}

export function parseDownloadFiles(stdout = "") {
  const seen = new Set();
  for (const raw of String(stdout).split("\n")) {
    const l = raw.trim();
    if (l.includes("%")) continue;
    const m = l.match(/Writing video (?:subtitles|thumbnail) to:\s*(.+)$/);
    if (m) {
      seen.add(m[1].trim());
      continue;
    }
    if (!isFilePath(l)) continue;
    seen.add(l);
  }
  return [...seen];
}

export function parseProgressLine(line = "") {
  const m = String(line).match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
  return m ? Number(m[1]) : null;
}

export function supportedSite(url = "", extractors = []) {
  let host = "";
  try {
    host = new URL(String(url)).hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  } catch {
    return null;
  }
  const labels = host.split(".");
  const names = new Map();
  for (const e of extractors) {
    const name = String(e).toLowerCase().split(":")[0];
    if (name && name.length >= 3 && !names.has(name)) names.set(name, e);
  }
  for (const label of labels) {
    if (names.has(label)) return names.get(label);
  }
  for (const label of labels) {
    for (const [name, e] of names) {
      if (name.startsWith(label) || label.startsWith(name)) return e;
    }
  }
  return null;
}

export function inspectPlan(info, { quality = null, want = "video" } = {}) {
  const fmts = info.formats || [];
  const looksVideo = (f) => (f.vcodec && f.vcodec !== "none") || (f.video_ext && f.video_ext !== "none") || /\.(mp4|webm|mkv|mov)$/i.test(f.url || "");
  const video = fmts.filter((f) => looksVideo(f) && (f.height || 0) > 0);
  const direct = fmts.length > 0 && video.length === 0 && fmts.some((f) => looksVideo(f));
  if (direct) return { action: "get_video", quality: "best", available: ["best"] };
  const heights = [...new Set(video.map((f) => f.height))].sort((x, y) => y - x);
  const separate = video.some((f) => (!f.acodec || f.acodec === "none") && f.ext !== "mp4");
  const available = heights.map((h) => (h >= 1080 ? "1080p" : h >= 720 ? "720p" : h >= 480 ? "480p" : "360p"));
  const uniq = [...new Set(available)];
  if (want === "audio") return { action: "get_audio", quality: "64K", available: uniq };
  if (!separate || !heights.length) return { action: "get_video", quality: "best", available: uniq };
  const q = quality || "720p";
  const pick = uniq.includes(q) ? q : uniq[uniq.length - 1] || "720p";
  return { action: "get_video", quality: pick, available: uniq };
}

const CODECS = {
  h264: { vcodec: "libx264", ext: "mp4", acodec: "aac" },
  hevc: { vcodec: "libx265", ext: "mp4", acodec: "aac" },
  vp9: { vcodec: "libvpx-vp9", ext: "webm", acodec: "libopus" },
  av1: { vcodec: "libaom-av1", ext: "mp4", acodec: "aac" },
};

export function platformPreset(site = "") {
  const s = String(site).toLowerCase();
  if (s.includes("tiktok")) return { codec: "h264", max_height: 1080, crf: 23, preset: "medium", note: "TikTok prefers H.264 mp4, vertical 1080x1920 max" };
  if (s.includes("instagram") || s.includes("reels")) return { codec: "h264", max_height: 1080, crf: 23, preset: "medium", note: "Reels prefers H.264 mp4 under 4GB, 1080p max" };
  if (s.includes("youtube") || s.includes("youtu.be")) return { codec: "h264", max_height: 2160, crf: 20, preset: "slow", note: "YouTube accepts anything; H.264 high-bitrate avoids a second transcode" };
  if (s.includes("twitter") || s.includes("x.com")) return { codec: "h264", max_height: 720, crf: 23, preset: "medium", note: "X caps at 720p / 512MB for most accounts" };
  return { codec: "h264", max_height: 1080, crf: 23, preset: "medium", note: "Generic H.264 mp4 plays everywhere" };
}

export function convertArgs({ input, output, codec = "h264", crf = 23, preset = "medium", max_height = 0 } = {}) {
  const c = CODECS[codec];
  if (!c) throw new Error(`unknown codec: ${codec}. Use h264, hevc, vp9, or av1.`);
  const a = ["-y", "-i", input, "-c:v", c.vcodec, "-crf", String(crf), "-preset", preset, "-c:a", c.acodec];
  if (max_height > 0) a.push("-vf", `scale=-2:min'(ih,${max_height})'`);
  a.push(output);
  return a;
}

const ADVICE = [
  {
    keys: ["cookie", "login", "sign in", "age gate", "blocked", "403", "private"],
    answer:
      "Cookies give yt-dlp your logged-in session. Export them from a desktop browser with an extension (Get cookies.txt LOCALLY) as Netscape format, then pass --cookies cookies.txt or set YTDLP_COOKIES_FILE. Never paste cookie contents into chat. Fixes: login walls, age gates, private videos, TikTok IP blocks.",
  },
  {
    keys: ["format", "quality", "720", "1080", "best", "height", "resolution", "selector"],
    answer:
      "Format selectors pick streams: bv*+ba/b means best video plus best audio merged. bv*[height<=720]+ba/b[height<=720]/b caps at 720p. b means single progressive file (no merge, what TikTok serves). best grabs the largest single file. --merge-output-format mp4 forces an mp4 container after merging.",
  },
  {
    keys: ["audio", "mp3", "opus", "extract", "m4a"],
    answer:
      "Audio extraction: -x --audio-format opus --audio-quality 64K is smallest. mp3 needs ffmpeg and is bigger at equal quality; use --audio-format mp3 --audio-quality 128K only for compatibility. m4a keeps AAC without re-encoding when the source is AAC.",
  },
  {
    keys: ["subtitle", "caption", "transcript", "vtt", "srt"],
    answer:
      "Subtitles: --write-subs grabs manual captions, --write-auto-subs adds auto-generated ones, --sub-langs en,id picks languages, --sub-format vtt/best normalizes to VTT. --skip-download fetches captions without the video.",
  },
  {
    keys: ["playlist", "channel", "batch", "archive"],
    answer:
      "Playlists: default to --no-playlist so one URL means one video. Opt in with --yes-playlist or --flat-playlist to list without downloading. --download-archive FILE skips already-fetched IDs across runs.",
  },
  {
    keys: ["proxy", "rate", "slow", "retry", "timeout", "network", "socket"],
    answer:
      "Network: --socket-timeout 20 avoids hangs, --retries 3 handles flakes, --proxy URL routes traffic, --sleep-requests 1 spaces calls to dodge rate limits. --concurrent-fragments 4 speeds DASH downloads.",
  },
  {
    keys: ["ffmpeg", "merge", "convert", "re-encode", "codec", "h264", "hevc", "compress"],
    answer:
      "Post-processing needs ffmpeg on PATH. Merging bv+ba uses --merge-output-format mp4. Re-encode with the convert tool: h264 plays everywhere, hevc halves size at equal quality but is slower, vp9/av1 suit web. CRF 23 is the balanced default; 20 is sharper, 28 is smaller.",
  },
  {
    keys: ["output", "filename", "template", "folder", "naming", "title"],
    answer:
      "Output template: -o \"%(title).80s [%(id)s].%(ext)s\" keeps names short and unique. %(uploader)s, %(upload_date)s, and %(playlist_index)s help organize bulk fetches. --print after_move:filepath reports the final path after merging.",
  },
];

export function adviseAnswer(question = "") {
  const q = String(question).toLowerCase();
  const hits = ADVICE.filter((d) => d.keys.some((k) => q.includes(k)));
  if (!hits.length) return "That is outside yt-dlp setup and download knowledge. Ask about cookies, formats, audio, subtitles, playlists, network, ffmpeg, or output naming.";
  return hits.map((h) => h.answer).join("\n\n");
}

export function queuePlan(items = [], { delay_s = 3, max = 20, quality = null, want = "video" } = {}) {
  return items.slice(0, Math.max(0, max)).map((item, i) => {
    const plan = inspectPlan(item.info || {}, { quality, want });
    return { url: item.url, wait_before_s: i === 0 ? 0 : delay_s, ...plan };
  });
}

export function watchArgs(url, { max = 20 } = {}) {
  return ["--flat-playlist", "--skip-download", "--playlist-end", String(max), "--print", "%(id)s\t%(title)s\t%(duration)s", url];
}

export function subtitleArgs(url, { lang = "en", auto = true, outDir = "." } = {}) {
  const a = ["--skip-download", "--write-subs", "--sub-format", "vtt/best", "--sub-langs", lang];
  if (auto) a.push("--write-auto-subs");
  a.push("-o", `${outDir}/%(title).80s [%(id)s].%(ext)s`, "--no-playlist", url);
  return a;
}

export function classifyError(message = "") {
  const m = String(message);
  if (/IP address is blocked|HTTP Error 403.*tiktok|TikTok.*blocked/i.test(m)) {
    return {
      code: "cookies_ip_block",
      hint: "TikTok blocked this IP or needs login. Export browser cookies to a Netscape file and retry with YTDLP_COOKIES_FILE set.",
    };
  }
  if (/sign in|log in|login required|age.*confirm|private video/i.test(m)) {
    return {
      code: "login_required",
      hint: "This video needs login or age confirmation. Export browser cookies and retry with YTDLP_COOKIES_FILE set.",
    };
  }
  if (/unavailable|has been removed|deleted|not available/i.test(m)) {
    return {
      code: "unavailable",
      hint: "The video is unavailable, removed, or geo-blocked. Try a different URL.",
    };
  }
  return { code: "unknown", hint: m.slice(0, 300) };
}

export function pickPlan(info, goal = "watch") {
  const fmts = info.formats || [];
  const video = fmts.filter((f) => f.vcodec && f.vcodec !== "none" && (f.height || 0) > 0);
  const separate = video.some(
    (f) => (!f.acodec || f.acodec === "none") && f.ext !== "mp4",
  );
  const has = (h) => video.some((f) => (f.height || 0) >= h);
  if (goal === "audio") {
    return {
      tool: "ytdlp_download_audio",
      args: { url: info.webpage_url, codec: "opus", quality: "64K" },
      why: "audio-only opus 64K, roughly half the size of 128k mp3",
    };
  }
  if (goal === "archive" || has(1080)) {
    if (!separate) {
      return {
        tool: "ytdlp_download_video",
        args: { url: info.webpage_url, quality: "best" },
        why: "single progressive file, best direct copy with no re-encode",
      };
    }
    return {
      tool: "ytdlp_download_video",
      args: { url: info.webpage_url, quality: goal === "archive" ? "best" : "1080p" },
      why: goal === "archive" ? "full-quality archive" : "1080p available",
    };
  }
  if (!separate) {
    return {
      tool: "ytdlp_download_video",
      args: { url: info.webpage_url, quality: "best" },
      why: "single progressive file, best direct copy avoids a wasteful re-encode",
    };
  }
  const cap = has(720) ? "720p" : has(480) ? "480p" : "360p";
  return {
    tool: "ytdlp_download_video",
    args: { url: info.webpage_url, quality: cap },
    why: `capped at ${cap}, bv+ba merged to mp4`,
  };
}

export function infoSummary(info, descChars = 400) {
  return {
    id: info.id,
    title: info.title,
    uploader: info.uploader || info.channel || null,
    duration_s: info.duration ?? null,
    duration_str: info.duration_string || null,
    view_count: info.view_count ?? null,
    upload_date: info.upload_date || null,
    webpage_url: info.webpage_url,
    thumbnail: info.thumbnail || null,
    description: (info.description || "").slice(0, descChars) || null,
    subtitles: Object.keys(info.subtitles || {}).slice(0, 10),
    auto_captions: Object.keys(info.automatic_captions || {}).slice(0, 10),
  };
}
