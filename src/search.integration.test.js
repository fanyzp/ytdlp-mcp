import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function createMcpClient(child) {
  let buffer = "";
  let nextId = 1;
  const pending = new Map();

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      const resolve = pending.get(message.id);
      if (resolve) {
        pending.delete(message.id);
        resolve(message);
      }
    }
  });

  return {
    request(method, params = {}) {
      const id = nextId++;
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for MCP ${method}`));
        }, 10_000);
        pending.set(id, (message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`,
      );
      return response;
    },
    notify(method, params = {}) {
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`,
      );
    },
  };
}

test("MCP server advertises unique tools and runs validated search end to end", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "ytdlp-mcp-search-test-"));
  const fakeYtDlp = join(scratch, "fake-ytdlp.mjs");
  const fixture = {
    extractor: "youtube:search",
    entries: [
      {
        id: "video-1",
        ie_key: "Youtube",
        title: "Quantum search result",
        duration: 42,
        uploader: "Example channel",
      },
    ],
  };
  await writeFile(
    fakeYtDlp,
    `process.stdout.write(JSON.stringify(${JSON.stringify(fixture)}));\n`,
  );

  const child = spawn(process.execPath, [join(projectRoot, "src/index.js")], {
    cwd: projectRoot,
    env: {
      ...process.env,
      YTDLP_BIN: process.execPath,
      YTDLP_BIN_PREFIX_ARGS: fakeYtDlp,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const client = createMcpClient(child);

  try {
    const initialized = await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "integration-test", version: "1.0.0" },
    });
    assert.equal(initialized.result.protocolVersion, "2024-11-05");
    client.notify("notifications/initialized");

    const listed = await client.request("tools/list");
    const tools = listed.result.tools;
    const toolNames = tools.map((tool) => tool.name);
    assert.equal(new Set(toolNames).size, toolNames.length);
    assert.equal(toolNames.length, 13);
    assert.ok(toolNames.includes("search"));

    const searchTool = tools.find((tool) => tool.name === "search");
    assert.deepEqual(searchTool.inputSchema.properties.provider.enum, [
      "youtube",
      "soundcloud",
    ]);
    assert.equal(searchTool.inputSchema.properties.limit.maximum, 50);

    const searched = await client.request("tools/call", {
      name: "search",
      arguments: { query: "quantum physics", limit: 1 },
    });
    assert.equal(searched.result.isError, undefined);
    assert.deepEqual(JSON.parse(searched.result.content[0].text), {
      extractor: "youtube:search",
      count: 1,
      results: [
        {
          id: "video-1",
          title: "Quantum search result",
          url: "youtube:video-1",
          duration_s: 42,
          uploader: "Example channel",
        },
      ],
    });

    for (const [name, args] of [
      ["search", { query: "  " }],
      ["search", { query: "quantum", provider: "unsupported" }],
      ["search", { query: "quantum", limit: 51 }],
    ]) {
      const rejected = await client.request("tools/call", {
        name,
        arguments: args,
      });
      assert.equal(
        rejected.result.isError,
        true,
        `${name} should reject invalid input`,
      );
    }
  } finally {
    child.kill();
    await once(child, "exit").catch(() => {});
    await rm(scratch, { recursive: true, force: true });
  }
});
