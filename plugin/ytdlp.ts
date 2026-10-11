import { Plugin } from "@opencode-ai/plugin";

declare const process: { env: Record<string, string | undefined> };

export default Plugin.define({
  id: "ytdlp-mcp",
  config: {
    mcp: {
      ytdlp: {
        type: "local",
        command: ["node", process.env.YTDLP_MCP_ENTRY || "ytdlp-mcp/src/index.js"],
        environment: {
          YTDLP_DOWNLOAD_DIR: process.env.YTDLP_DOWNLOAD_DIR || "~/Downloads/ytdlp-mcp",
        },
      },
    },
  },
});
