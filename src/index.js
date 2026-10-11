#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  VERSION,
  HEIGHT_CAP,
  defaultDir,
  baseArgs,
  videoSelector,
  compactFormats,
  pickPlan,
  infoSummary,
  classifyError,
  parseDownloadFiles,
  parseProgressLine,
  subtitleArgs,
  supportedSite,
  inspectPlan,
  adviseAnswer,
  convertArgs,
  platformPreset,
  queuePlan,
  watchArgs,
  ytdlpCommand,
} from "./lib.js";

import { parseToolArguments, toolInputSchema } from "./schemas.js";
import { buildSearchUrl, normalizeSearchResults } from "./search.js";

const execFileAsync = promisify(execFile);
const YTDLP_BIN = process.env.YTDLP_BIN || "yt-dlp";
const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg";
const YTDLP_PREFIX = (process.env.YTDLP_BIN_PREFIX_ARGS || "")
  .split(" ")
  .filter(Boolean);
const COOKIES_FILE = process.env.YTDLP_COOKIES_FILE || "";
const META_TIMEOUT = Number(process.env.YTDLP_META_TIMEOUT_MS || 60_000);
const DL_TIMEOUT = Number(process.env.YTDLP_DL_TIMEOUT_MS || 1_800_000);

function ytArgs(extra) {
  return [...YTDLP_PREFIX, ...extra];
}

async function dumpInfo(url, extraArgs = []) {
  const { stdout } = await execFileAsync(
    YTDLP_BIN,
    ytArgs(
      baseArgs(
        [
          "--dump-single-json",
          "--no-playlist",
          "--skip-download",
          ...extraArgs,
          "--socket-timeout",
          "20",
          url,
        ],
        COOKIES_FILE,
      ),
    ),
    { maxBuffer: 64 * 1024 * 1024, timeout: META_TIMEOUT },
  );
  return JSON.parse(stdout);
}

function runStreaming(bin, args, onProgress) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { timeout: DL_TIMEOUT });
    let out = "";
    let err = "";
    let lastPct = -1;
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => {
      err += d;
      for (const line of String(d).split("\n")) {
        const pct = parseProgressLine(line);
        if (pct !== null && pct - lastPct >= 10) {
          lastPct = pct;
          try {
            onProgress(pct);
          } catch {}
        }
      }
      if (out.length > 16 * 1024 * 1024) out = out.slice(-1024 * 1024);
      if (err.length > 1024 * 1024) err = err.slice(-65536);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve({ stdout: out, stderr: err })
        : reject(Object.assign(new Error(err.slice(-1500)), { stderr: err })),
    );
  });
}

async function runDownload(args, outDir, onProgress = () => {}) {
  await mkdir(outDir, { recursive: true });
  const { bin } = ytdlpCommand(YTDLP_BIN);
  const { stdout, stderr } = await runStreaming(bin, ytArgs(args), onProgress);
  return {
    files: parseDownloadFiles(stdout),
    log_tail: (stderr || "").slice(-800),
  };
}

const QUALITIES = ["360p", "480p", "720p", "1080p", "best"];

const TOOLS = [
  {
    name: "probe",
    description:
      "VIEW metadata only: title, duration, uploader, views, thumbnail, short description. One yt-dlp call, no download. Works on any site yt-dlp supports (1300+ extractors). Call this first to see what a URL contains.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Any media URL" },
        desc_chars: {
          type: "number",
          default: 400,
          description: "Truncate the description to this many characters",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "formats",
    description:
      "VIEW available formats only: compact list of video/audio qualities and sizes for a URL. One yt-dlp call, no download.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Any media URL" },
        limit: { type: "number", default: 25 },
      },
      required: ["url"],
    },
  },
  {
    name: "supported",
    description:
      "VIEW site support only: check whether a URL belongs to a site yt-dlp can handle, and name the matched extractor. No download.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Any media URL" },
      },
      required: ["url"],
    },
  },
  {
    name: "inspect",
    description:
      "VIEW resolution plan only: probe a URL once and return which qualities exist plus the recommended download action (get_video/get_audio) and quality. Full automation: use its output to call the right download tool without asking the user. No download.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Any media URL" },
        quality: {
          type: "string",
          enum: QUALITIES,
          description:
            "Preferred quality; omitted means auto (720p or best direct copy)",
        },
        want: { type: "string", enum: ["video", "audio"], default: "video" },
      },
      required: ["url"],
    },
  },
  {
    name: "get_video",
    description:
      "DOWNLOAD video to mp4. One action per call: video only. Defaults to 720p; progressive single-file sources (TikTok) always use best direct copy.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Any media URL" },
        quality: { type: "string", enum: QUALITIES, default: "720p" },
        out_dir: {
          type: "string",
          description: "Defaults to YTDLP_DOWNLOAD_DIR",
        },
        allow_playlist: { type: "boolean", default: false },
      },
      required: ["url"],
    },
  },
  {
    name: "get_audio",
    description:
      "DOWNLOAD audio only. One action per call: audio only, default opus 64K.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Any media URL" },
        codec: {
          type: "string",
          enum: ["opus", "mp3", "m4a"],
          default: "opus",
        },
        quality: {
          type: "string",
          default: "64K",
          description: "Example: 64K is cheap, 128K is higher quality",
        },
        out_dir: {
          type: "string",
          description: "Defaults to YTDLP_DOWNLOAD_DIR",
        },
        allow_playlist: { type: "boolean", default: false },
      },
      required: ["url"],
    },
  },
  {
    name: "get_subtitles",
    description:
      "DOWNLOAD subtitles only as VTT (manual subs preferred, auto-subs fallback). One action per call: subtitles only, no video.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Any media URL" },
        lang: {
          type: "string",
          default: "en",
          description: "Subtitle language code, example: en, id",
        },
        auto: {
          type: "boolean",
          default: true,
          description: "Fall back to auto-generated captions",
        },
        out_dir: {
          type: "string",
          description: "Defaults to YTDLP_DOWNLOAD_DIR",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "advise",
    description:
      "KNOWLEDGE question answering about yt-dlp itself: cookies, format selectors, audio extraction, subtitles, playlists, network flags, ffmpeg, output naming. No download. Use when the user asks HOW yt-dlp works or how to configure something.",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The yt-dlp question, example: how do cookies work",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "queue",
    description:
      "BULK plan only: probe many URLs at once and return one plan per item (action, quality, wait_before_s delay). No download. Use to automate a batch before running fetch_all.",
    inputSchema: {
      type: "object",
      properties: {
        urls: {
          type: "array",
          items: { type: "string" },
          description: "List of media URLs",
        },
        quality: {
          type: "string",
          enum: QUALITIES,
          description: "Preferred quality for all items",
        },
        want: { type: "string", enum: ["video", "audio"], default: "video" },
        delay_s: {
          type: "number",
          default: 3,
          description: "Pause between items to avoid rate limits",
        },
        max: { type: "number", default: 20, description: "Cap the batch size" },
      },
      required: ["urls"],
    },
  },
  {
    name: "fetch_all",
    description:
      "BULK download: run a batch of URLs with delay between items and per-item progress. Returns one result per URL. Use queue first to preview, then fetch_all to execute.",
    inputSchema: {
      type: "object",
      properties: {
        urls: {
          type: "array",
          items: { type: "string" },
          description: "List of media URLs",
        },
        quality: { type: "string", enum: QUALITIES, default: "720p" },
        want: { type: "string", enum: ["video", "audio"], default: "video" },
        delay_s: {
          type: "number",
          default: 3,
          description: "Pause between items to avoid rate limits",
        },
        max: { type: "number", default: 20, description: "Cap the batch size" },
        out_dir: {
          type: "string",
          description: "Defaults to YTDLP_DOWNLOAD_DIR",
        },
      },
      required: ["urls"],
    },
  },
  {
    name: "watch",
    description:
      "BULK list only: list videos in a playlist or channel (flat, no download) so the agent can archive new items on a schedule. Returns id, title, duration per entry.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Playlist or channel URL" },
        max: { type: "number", default: 20, description: "Cap entries listed" },
      },
      required: ["url"],
    },
  },
  {
    name: "search",
    description:
      "SEARCH videos using yt-dlp search extractors. Providers: YouTube and SoundCloud. Returns compact metadata only, no download.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search terms" },
        provider: {
          type: "string",
          enum: ["youtube", "soundcloud"],
          default: "youtube",
        },
        limit: {
          type: "number",
          default: 10,
          description: "Maximum results (1-50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "convert",
    description:
      "CONVERT a local video file with ffmpeg to a social-ready codec. Ask the user which platform it is for (or pass site) because the preset depends on preference; default h264. One action per call: transcode only.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "Local input video path" },
        output: { type: "string", description: "Local output path" },
        site: {
          type: "string",
          description:
            "Target platform for preset, example: tiktok, instagram, youtube. Empty means generic h264.",
        },
        codec: {
          type: "string",
          enum: ["h264", "hevc", "vp9", "av1"],
          description: "Overrides the site preset codec",
        },
        crf: {
          type: "number",
          default: 23,
          description: "Quality: 20 sharper, 23 balanced, 28 smaller",
        },
      },
      required: ["input", "output"],
    },
  },
];

const server = new Server(
  { name: "ytdlp-mcp", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((tool) => ({
    ...tool,
    inputSchema: toolInputSchema(tool.name),
  })),
}));

async function listExtractors() {
  const { bin } = ytdlpCommand(YTDLP_BIN);
  const { stdout } = await execFileAsync(bin, ytArgs(["--list-extractors"]), {
    maxBuffer: 4 * 1024 * 1024,
    timeout: META_TIMEOUT,
  });
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: rawArgs = {} } = req.params;
  const ok = (obj) => ({
    content: [{ type: "text", text: JSON.stringify(obj, null, 1) }],
  });
  try {
    const a = parseToolArguments(name, rawArgs);
    if (name === "probe") {
      const info = await dumpInfo(a.url);
      return ok({
        ...infoSummary(info, a.desc_chars ?? 400),
        extractor: info.extractor || null,
      });
    }
    if (name === "formats") {
      const info = await dumpInfo(a.url);
      return ok({
        title: info.title,
        extractor: info.extractor || null,
        formats: compactFormats(info, a.limit ?? 25),
      });
    }
    if (name === "supported") {
      const extractors = await listExtractors();
      const site = supportedSite(a.url, extractors);
      return ok({ url: a.url, supported: site !== null, site });
    }
    if (name === "inspect") {
      const info = await dumpInfo(a.url);
      return ok({
        title: info.title,
        extractor: info.extractor || null,
        ...inspectPlan(info, {
          quality: a.quality || null,
          want: a.want || "video",
        }),
      });
    }
    if (
      name === "ytdlp_resolve" ||
      name === "ytdlp_metadata" ||
      name === "ytdlp_formats"
    ) {
      const info = await dumpInfo(a.url);
      return ok({
        ...infoSummary(info, 200),
        note: "renamed: use probe/formats/inspect",
      });
    }
    const progress = (pct) => {
      try {
        server.notification({
          method: "notifications/progress",
          params: { progress: pct, total: 100 },
        });
      } catch {}
    };
    if (name === "get_video" || name === "ytdlp_download_video") {
      const outDir = a.out_dir || defaultDir();
      const q = a.quality || "720p";
      const fmt = q === "best" ? "bv*+ba/b" : videoSelector(HEIGHT_CAP[q]);
      const pl = a.allow_playlist ? ["--yes-playlist"] : ["--no-playlist"];
      const r = await runDownload(
        baseArgs(
          [
            "-f",
            fmt,
            "--merge-output-format",
            "mp4",
            "-o",
            join(outDir, "%(title).80s [%(id)s].%(ext)s"),
            "--print",
            "after_move:filepath",
            ...pl,
            a.url,
          ],
          COOKIES_FILE,
        ),
        outDir,
        progress,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { quality: q, out_dir: outDir, ...r },
              null,
              1,
            ),
          },
        ],
      };
    }
    if (name === "get_audio" || name === "ytdlp_download_audio") {
      const outDir = a.out_dir || defaultDir();
      const pl = a.allow_playlist ? ["--yes-playlist"] : ["--no-playlist"];
      const r = await runDownload(
        baseArgs(
          [
            "-x",
            "--extract-audio",
            "--audio-format",
            a.codec || "opus",
            "--audio-quality",
            a.quality || "64K",
            "-o",
            join(outDir, "%(title).80s [%(id)s].%(ext)s"),
            "--print",
            "after_move:filepath",
            ...pl,
            a.url,
          ],
          COOKIES_FILE,
        ),
        outDir,
        progress,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ out_dir: outDir, ...r }, null, 1),
          },
        ],
      };
    }
    if (name === "get_subtitles" || name === "ytdlp_subtitles") {
      const outDir = a.out_dir || defaultDir();
      await mkdir(outDir, { recursive: true });
      const { bin } = ytdlpCommand(YTDLP_BIN);
      const { stdout, stderr } = await runStreaming(
        bin,
        ytArgs(
          baseArgs(
            subtitleArgs(a.url, {
              lang: a.lang || "en",
              auto: a.auto ?? true,
              outDir,
            }),
            COOKIES_FILE,
          ),
        ),
        progress,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                lang: a.lang || "en",
                out_dir: outDir,
                files: parseDownloadFiles(stdout),
                log_tail: (stderr || "").slice(-800),
              },
              null,
              1,
            ),
          },
        ],
      };
    }
    if (name === "advise") {
      return ok({ answer: adviseAnswer(a.question || "") });
    }
    if (name === "search") {
      const searchUrl = buildSearchUrl(a.provider, a.query, a.limit);
      const info = await dumpInfo(searchUrl, ["--flat-playlist"]);
      return ok(normalizeSearchResults(info));
    }
    if (name === "queue") {
      const urls = (a.urls || []).slice(0, Math.max(0, a.max ?? 20));
      const items = [];
      for (const url of urls) {
        try {
          items.push({ url, info: await dumpInfo(url) });
        } catch (e) {
          items.push({
            url,
            info: {},
            error: classifyError(e.stderr || e.message || "").code,
          });
        }
      }
      return ok({
        plans: queuePlan(items, {
          delay_s: a.delay_s ?? 3,
          max: a.max ?? 20,
          quality: a.quality || null,
          want: a.want || "video",
        }),
      });
    }
    if (name === "fetch_all") {
      const outDir = a.out_dir || defaultDir();
      const urls = (a.urls || []).slice(0, Math.max(0, a.max ?? 20));
      const delay = (a.delay_s ?? 3) * 1000;
      const results = [];
      for (let i = 0; i < urls.length; i++) {
        if (i > 0 && delay > 0) await new Promise((r) => setTimeout(r, delay));
        const url = urls[i];
        try {
          const info = await dumpInfo(url);
          const plan = inspectPlan(info, {
            quality: a.quality || null,
            want: a.want || "video",
          });
          const q = plan.quality === "64K" ? "720p" : plan.quality;
          const fmt =
            q === "best" ? "bv*+ba/b" : videoSelector(HEIGHT_CAP[q] || 720);
          const isAudio =
            plan.action === "get_audio" || (a.want || "video") === "audio";
          const dlArgs = isAudio
            ? [
                "-x",
                "--extract-audio",
                "--audio-format",
                a.codec || "opus",
                "--audio-quality",
                a.quality || "64K",
              ]
            : ["-f", fmt, "--merge-output-format", "mp4"];
          const r = await runDownload(
            baseArgs(
              [
                ...dlArgs,
                "-o",
                join(outDir, "%(title).80s [%(id)s].%(ext)s"),
                "--print",
                "after_move:filepath",
                "--no-playlist",
                url,
              ],
              COOKIES_FILE,
            ),
            outDir,
            progress,
          );
          results.push({ url, ok: true, ...r });
        } catch (e) {
          const c = classifyError(e.stderr || e.message || "");
          results.push({ url, ok: false, code: c.code, hint: c.hint });
        }
      }
      return ok({ out_dir: outDir, results });
    }
    if (name === "watch") {
      const { bin } = ytdlpCommand(YTDLP_BIN);
      const { stdout } = await execFileAsync(
        bin,
        ytArgs(baseArgs(watchArgs(a.url, { max: a.max ?? 20 }), COOKIES_FILE)),
        {
          maxBuffer: 16 * 1024 * 1024,
          timeout: META_TIMEOUT,
        },
      );
      const entries = stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [id, title, duration] = l.split("\t");
          return { id, title, duration };
        });
      return ok({ url: a.url, count: entries.length, entries });
    }
    if (name === "convert") {
      const preset = platformPreset(a.site || "");
      const codec = a.codec || preset.codec;
      const args = convertArgs({
        input: a.input,
        output: a.output,
        codec,
        crf: a.crf ?? preset.crf,
        preset: preset.preset,
        max_height: preset.max_height,
      });
      const { stderr } = await runStreaming(FFMPEG_BIN, args, progress);
      return ok({
        input: a.input,
        output: a.output,
        codec,
        preset: preset.note,
        log_tail: (stderr || "").slice(-800),
      });
    }
    throw new Error(`unknown tool: ${name}`);
  } catch (e) {
    const raw = e.stderr || e.message || String(e);
    const c = classifyError(raw);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: raw.slice(0, 1500), code: c.code, hint: c.hint },
            null,
            1,
          ),
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
