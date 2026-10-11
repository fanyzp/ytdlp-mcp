import { z } from "zod";

const url = z.string().url();
const quality = z.enum(["360p", "480p", "720p", "1080p", "best"]);
const outputDirectory = z.string().min(1).optional();
const playlist = z.boolean().default(false);
const boundedLimit = (fallback, maximum) =>
  z.number().int().min(1).max(maximum).default(fallback);

export const toolSchemas = {
  probe: z.object({
    url,
    desc_chars: z.number().int().min(0).max(400).default(400),
  }),
  formats: z.object({ url, limit: boundedLimit(25, 25) }),
  supported: z.object({ url }),
  inspect: z.object({
    url,
    quality: quality.optional(),
    want: z.enum(["video", "audio"]).default("video"),
  }),
  get_video: z.object({
    url,
    quality: quality.default("720p"),
    out_dir: outputDirectory,
    allow_playlist: playlist,
  }),
  get_audio: z.object({
    url,
    codec: z.enum(["opus", "mp3", "m4a"]).default("opus"),
    quality: z
      .string()
      .regex(/^\d{1,3}K$/)
      .default("64K"),
    out_dir: outputDirectory,
    allow_playlist: playlist,
  }),
  get_subtitles: z.object({
    url,
    lang: z.string().min(2).max(16).default("en"),
    auto: z.boolean().default(true),
    out_dir: outputDirectory,
  }),
  advise: z.object({ question: z.string().min(1).max(2000) }),
  queue: z.object({
    urls: z.array(url).min(1).max(100),
    quality: quality.optional(),
    want: z.enum(["video", "audio"]).default("video"),
    delay_s: z.number().min(0).max(3600).default(3),
    max: boundedLimit(20, 100),
  }),
  fetch_all: z.object({
    urls: z.array(url).min(1).max(100),
    quality: quality.default("720p"),
    want: z.enum(["video", "audio"]).default("video"),
    delay_s: z.number().min(0).max(3600).default(3),
    max: boundedLimit(20, 100),
    out_dir: outputDirectory,
    codec: z.enum(["opus", "mp3", "m4a"]).default("opus"),
  }),
  watch: z.object({ url, max: boundedLimit(20, 500) }),
  search: z.object({
    query: z.string().trim().min(1).max(500),
    provider: z.enum(["youtube", "soundcloud"]).default("youtube"),
    limit: boundedLimit(10, 50),
  }),
  convert: z.object({
    input: z.string().min(1),
    output: z.string().min(1),
    site: z.string().max(100).optional(),
    codec: z.enum(["h264", "hevc", "vp9", "av1"]).optional(),
    crf: z.number().int().min(0).max(51).default(23),
  }),
};

export function parseToolArguments(name, args) {
  const aliases = {
    ytdlp_resolve: "probe",
    ytdlp_metadata: "probe",
    ytdlp_formats: "formats",
    ytdlp_download_video: "get_video",
    ytdlp_download_audio: "get_audio",
    ytdlp_subtitles: "get_subtitles",
  };
  const schema = toolSchemas[aliases[name] || name];
  if (!schema) throw new Error(`Unknown tool schema: ${name}`);
  return schema.parse(args);
}

export function toolInputSchema(name) {
  const schema = toolSchemas[name];
  if (!schema) throw new Error(`Unknown tool schema: ${name}`);
  const jsonSchema = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  return jsonSchema;
}
