import test from "node:test";
import assert from "node:assert/strict";
import { toolSchemas } from "./schemas.js";
import { buildSearchUrl, normalizeSearchResults } from "./search.js";

test("search schema requires a non-empty query and bounds result count", () => {
  assert.equal(toolSchemas.search.parse({ query: "cats" }).limit, 10);
  assert.throws(() => toolSchemas.search.parse({ query: "   " }));
  assert.throws(() => toolSchemas.search.parse({ query: "cats", limit: 100 }));
  assert.throws(() =>
    toolSchemas.search.parse({ query: "cats", provider: "unknown" }),
  );
});

test("search URL constructs supported yt-dlp prefixes", () => {
  assert.equal(
    buildSearchUrl("youtube", "quantum cats", 5),
    "ytsearch5:quantum cats",
  );
  assert.equal(
    buildSearchUrl("soundcloud", "ambient music", 3),
    "scsearch3:ambient music",
  );
  assert.throws(() => buildSearchUrl("unsupported", "cats", 5));
});

test("search results expose a compact stable metadata shape", () => {
  assert.deepEqual(
    normalizeSearchResults({
      title: "Search results",
      extractor: "youtube:search",
      entries: [
        {
          id: "a1",
          title: "First",
          url: "https://example.com/a",
          duration: 12,
          uploader: "Uploader",
        },
        {
          id: "b2",
          ie_key: "Youtube",
          title: "Second",
        },
        null,
      ],
    }),
    {
      extractor: "youtube:search",
      count: 2,
      results: [
        {
          id: "a1",
          title: "First",
          url: "https://example.com/a",
          duration_s: 12,
          uploader: "Uploader",
        },
        {
          id: "b2",
          title: "Second",
          url: "youtube:b2",
          duration_s: null,
          uploader: null,
        },
      ],
    },
  );
});

test("shared tool schemas validate URL and tool-specific constraints", () => {
  assert.throws(() => toolSchemas.probe.parse({ url: "not a URL" }));
  assert.throws(() =>
    toolSchemas.get_video.parse({
      url: "https://example.com/video",
      quality: "144p",
    }),
  );
  assert.equal(
    toolSchemas.get_video.parse({ url: "https://example.com/video" }).quality,
    "720p",
  );
  assert.throws(() =>
    toolSchemas.convert.parse({ input: "in.mp4", output: "out.mp4", crf: 60 }),
  );
});
