import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync, unlinkSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function detectOS(platform = process.platform) {
  if (platform === "win32") return "windows";
  if (platform === "darwin") return "macos";
  if (platform === "linux") return "linux";
  return "other";
}

export function nodeMeetsMinimum(version = process.version) {
  const major = Number(String(version).replace(/^v/, "").split(".")[0]);
  return Number.isFinite(major) && major >= 18;
}

export function opencodeConfigPath(home = homedir(), platform = process.platform, appData = process.env.APPDATA) {
  const os = detectOS(platform);
  if (os === "windows") return join(appData || join(home, "AppData/Roaming"), "opencode/opencode.json");
  if (os === "macos") return join(home, "Library/Application Support/opencode/opencode.json");
  return join(home, ".config/opencode/opencode.json");
}

export function geminiConfigPath(home = homedir()) {
  return join(home, ".gemini/settings.json");
}

export function claudeConfigPath(home = homedir()) {
  return join(home, ".claude.json");
}

export function piSkillsDir(home = homedir()) {
  return join(home, ".pi/agent/skills");
}

export const TARGETS = [
  { id: "hermes", label: "Hermes Agent (mcp add)", kind: "cli" },
  { id: "opencode-mcp", label: "OpenCode MCP server", kind: "json" },
  { id: "opencode-plugin", label: "OpenCode plugin", kind: "file" },
  { id: "gemini", label: "Gemini CLI + Antigravity (shared settings)", kind: "json" },
  { id: "claude", label: "Claude Code", kind: "json" },
  { id: "openclaw", label: "OpenClaw (mcp add)", kind: "cli" },
  { id: "codex", label: "Codex CLI (config.toml)", kind: "toml" },
  { id: "cursor", label: "Cursor (mcp.json)", kind: "json" },
  { id: "copilot", label: "Copilot CLI (mcp-config.json)", kind: "json" },
  { id: "cline", label: "Cline (skills only)", kind: "skill" },
  { id: "pi", label: "Pi agent (skills only)", kind: "skill" },
  { id: "manual", label: "Manual (print config block)", kind: "print" },
];

export function codexConfigPath(home = homedir()) {
  return join(home, ".codex/config.toml");
}

export function cursorConfigPath(home = homedir()) {
  return join(home, ".cursor/mcp.json");
}

export function copilotConfigPath(home = homedir()) {
  return join(home, ".copilot/mcp-config.json");
}

export function clineSkillsDir(home = homedir()) {
  return join(home, ".cline/skills");
}

export function parseOnly(argv = process.argv) {
  const onlyArg = argv.find((a) => a.startsWith("--only="));
  const allArg = argv.includes("--all");
  if (allArg) return [];
  return onlyArg ? onlyArg.slice(7).split(",").map((s) => s.trim()).filter(Boolean) : null;
}

export function opencodePluginDir(home = homedir(), platform = process.platform) {
  const os = detectOS(platform);
  if (os === "windows") return join(home, ".config/opencode/plugins");
  if (os === "macos") return join(home, ".config/opencode/plugins");
  return join(home, ".config/opencode/plugins");
}

export function targetsList() {
  return TARGETS.map((t) => t.id);
}

export const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function tuiToggle(selected, cursor) {
  const next = [...selected];
  next[cursor] = !next[cursor];
  return next;
}

export function tuiMove(cursor, delta, total) {
  return (cursor + delta + total) % total;
}

export function tuiFrame(targets, selected, cursor, spinTick) {
  const spin = SPIN[spinTick % SPIN.length];
  const lines = [`${spin} ytdlp-mcp installer`, "", "Space toggle, arrows move, Enter confirm, a select all:"];
  targets.forEach((t, i) => {
    const box = selected[i] ? "[x]" : "[ ]";
    const arrow = i === cursor ? ">" : " ";
    lines.push(`${arrow} ${box} ${t.label}`);
  });
  const count = selected.filter(Boolean).length;
  lines.push("", `${count}/${targets.length} selected`);
  return lines.join("\n");
}

export function antigravityNote(home = homedir()) {
  return geminiConfigPath(home);
}

export async function promptTargets() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const { createInterface } = await import("node:readline");
    console.log("\nSelect install targets (space-separated numbers, empty = all):");
    TARGETS.forEach((t, i) => console.log(`  ${i + 1}. ${t.label}`));
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => rl.question("> ", resolve));
    rl.close();
    const nums = String(answer).trim();
    if (!nums) return [];
    return [...new Set(
      nums.split(/[\s,]+/).map(Number).filter((n) => n >= 1 && n <= TARGETS.length).map((n) => TARGETS[n - 1].id),
    )];
  }
  const stdin = process.stdin;
  const stdout = process.stdout;
  stdin.setRawMode(true);
  stdin.resume();
  let cursor = 0;
  let selected = TARGETS.map(() => true);
  let tick = 0;
  const paint = () => {
    stdout.write("\x1b[2J\x1b[H" + tuiFrame(TARGETS, selected, cursor, tick));
  };
  const spinTimer = setInterval(() => {
    tick++;
    paint();
  }, 120);
  paint();
  return new Promise((resolve) => {
    const done = (ids) => {
      clearInterval(spinTimer);
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      resolve(ids);
    };
    const onData = (buf) => {
      const key = buf.toString();
      if (key === "\x03") {
        done(null);
        process.exit(1);
      }
      if (key === "\r" || key === "\n") {
        const ids = TARGETS.filter((_, i) => selected[i]).map((t) => t.id);
        done(ids.length === TARGETS.length ? [] : ids);
      } else if (key === " ") {
        selected = tuiToggle(selected, cursor);
        paint();
      } else if (key === "a" || key === "A") {
        selected = TARGETS.map(() => true);
        paint();
      } else if (key === "\x1b[A") {
        cursor = tuiMove(cursor, -1, TARGETS.length);
        paint();
      } else if (key === "\x1b[B") {
        cursor = tuiMove(cursor, 1, TARGETS.length);
        paint();
      }
    };
    stdin.on("data", onData);
  });
}

export function spinnerWrap(label) {
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r${SPIN[i++ % SPIN.length]} ${label}`);
  }, 80);
  return () => {
    clearInterval(timer);
    process.stdout.write(`\r\x1b[K\x1b[32m\x1b[1m\u2713\x1b[0m ${label}\n`);
  };
}

export function hermesSkillsDir(home = homedir(), env = process.env) {
  const base = env.HERMES_HOME || join(home, ".hermes");
  return join(base, "skills");
}

export function defaultDownloadDir(home = homedir()) {
  return join(home, "Downloads/ytdlp-mcp");
}

export function dependencyHint(os = detectOS()) {
  if (os === "windows") return "install yt-dlp and ffmpeg: winget install yt-dlp ffmpeg";
  if (os === "macos") return "install yt-dlp and ffmpeg: brew install yt-dlp ffmpeg";
  return "install yt-dlp and ffmpeg from your distro repos or https://github.com/yt-dlp/yt-dlp, plus ffmpeg from https://ffmpeg.org/download.html";
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    if (existsSync(path)) throw e;
    return {};
  }
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

export function hermesHasYtdlp(run = execSync) {
  try {
    const out = run("hermes mcp list", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return /^[*\s]*ytdlp[\s|]/m.test(String(out));
  } catch {
    return false;
  }
}

function registerHermes(entry, run = execSync) {
  try {
    run(`hermes --version`, { stdio: "ignore" });
  } catch {
    console.log("hermes CLI not found, skipping Hermes registration");
    return;
  }
  if (hermesHasYtdlp(run)) {
    console.log("hermes: ytdlp already registered, skipping");
    return;
  }
  try {
    run(`hermes mcp add ytdlp --command node --args "${entry}"`, { stdio: "inherit", timeout: 30000, input: "Y\n" });
  } catch {
    console.log("Hermes registration needs confirmation, run: hermes mcp add ytdlp --command node --args " + entry);
  }
}

function registerOpencode(entry, outDir, home, platform, appData) {
  const p = opencodeConfigPath(home, platform, appData);
  const d = readJson(p);
  d.mcp = d.mcp || {};
  d.mcp.servers = d.mcp.servers || {};
  d.mcp.servers.ytdlp = { type: "local", command: ["node", entry], environment: { YTDLP_DOWNLOAD_DIR: outDir } };
  writeJson(p, d);
  console.log("opencode: ytdlp registered -> " + p);
}

function registerStdioJson(path, entry, outDir) {
  const d = readJson(path);
  d.mcpServers = d.mcpServers || {};
  d.mcpServers.ytdlp = { command: "node", args: [entry], env: { YTDLP_DOWNLOAD_DIR: outDir } };
  writeJson(path, d);
  console.log(path + ": ytdlp registered");
}

function linkSkill(repoDir, home, env, bases = null) {
  const dirs = bases || [hermesSkillsDir(home, env), piSkillsDir(home), clineSkillsDir(home)];
  for (const base of dirs) {
    const dir = join(base, "ytdlp-mcp");
    mkdirSync(dirname(dir), { recursive: true });
    try {
      unlinkSync(dir);
    } catch {}
    try {
      symlinkSync(join(repoDir, "skill"), dir, "junction");
      console.log("skill linked -> " + dir);
    } catch {
      console.log("skill symlink failed, copy skill/ to: " + dir);
    }
  }
}

function registerOpenclaw(entry, outDir, run = execSync) {
  try {
    run("openclaw --version", { stdio: "ignore" });
  } catch {
    console.log("openclaw CLI not found, printing manual command instead:");
    console.log(`  openclaw mcp add ytdlp --command node --arg ${entry} --env YTDLP_DOWNLOAD_DIR=${outDir}`);
    return;
  }
  try {
    run(`openclaw mcp add ytdlp --command node --arg ${entry} --env YTDLP_DOWNLOAD_DIR=${outDir}`, { stdio: "inherit", timeout: 30000 });
  } catch {
    console.log(`openclaw registration needs attention, run: openclaw mcp add ytdlp --command node --arg ${entry}`);
  }
}

function registerCodexToml(entry, outDir, home) {
  const p = codexConfigPath(home);
  let text = "";
  try {
    text = readFileSync(p, "utf8");
  } catch {
    if (existsSync(p)) throw new Error("cannot read " + p);
  }
  if (text.includes("[mcp_servers.ytdlp]")) {
    console.log("codex: ytdlp already registered, skipping");
    return;
  }
  const block = `\n[mcp_servers.ytdlp]\ncommand = "node"\nargs = ["${entry}"]\n[mcp_servers.ytdlp.env]\nYTDLP_DOWNLOAD_DIR = "${outDir}"\n`;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text.replace(/\s+$/, "\n") + block);
  console.log("codex: ytdlp registered -> " + p);
}

function registerCursor(entry, outDir, home) {
  const p = cursorConfigPath(home);
  const d = readJson(p);
  d.mcpServers = d.mcpServers || {};
  d.mcpServers.ytdlp = { command: "node", args: [entry], env: { YTDLP_DOWNLOAD_DIR: outDir } };
  writeJson(p, d);
  console.log("cursor: ytdlp registered -> " + p);
}

function registerCopilot(entry, outDir, home) {
  const p = copilotConfigPath(home);
  const d = readJson(p);
  d.mcpServers = d.mcpServers || {};
  d.mcpServers.ytdlp = { command: "node", args: [entry], env: { YTDLP_DOWNLOAD_DIR: outDir }, tools: ["*"] };
  writeJson(p, d);
  console.log("copilot: ytdlp registered -> " + p);
}

function installOpencodePlugin(repoDir, home, platform) {
  const dir = opencodePluginDir(home, platform);
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(repoDir, "plugin/ytdlp.ts"), join(dir, "ytdlp.ts"));
  console.log("opencode plugin installed -> " + join(dir, "ytdlp.ts"));
}

export function opencodeCommandsDir(home = homedir()) {
  return join(home, ".config/opencode/commands");
}

export function geminiCommandsDir(home = homedir()) {
  return join(home, ".gemini/commands");
}

export function claudeCommandsDir(home = homedir()) {
  return join(home, ".claude/commands");
}

function installSlashCommands(repoDir, home) {
  const pairs = [
    [join(repoDir, "commands/ytdlp-mcp.md"), join(opencodeCommandsDir(home), "ytdlp-mcp.md")],
    [join(repoDir, "commands/ytdlp-mcp.toml"), join(geminiCommandsDir(home), "ytdlp-mcp.toml")],
    [join(repoDir, "commands/ytdlp-mcp.md"), join(claudeCommandsDir(home), "ytdlp-mcp.md")],
  ];
  for (const [src, dest] of pairs) {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    console.log("slash command installed -> " + dest);
  }
}

export function manualBlock(entry, outDir) {
  return [
    "Manual install (any MCP client):",
    `  command: node`,
    `  args: ["${entry}"]`,
    `  env: { YTDLP_DOWNLOAD_DIR: "${outDir}" }`,
    "OpenCode opencode.json:",
    `  { "mcp": { "servers": { "ytdlp": { "type": "local", "command": ["node", "${entry}"], "environment": { "YTDLP_DOWNLOAD_DIR": "${outDir}" } } } } }`,
    "Gemini/Claude settings:",
    `  { "mcpServers": { "ytdlp": { "command": "node", "args": ["${entry}"], "env": { "YTDLP_DOWNLOAD_DIR": "${outDir}" } } } }`,
  ].join("\n");
}

function checkDep(bin, os) {
  const flag = bin === "ffmpeg" ? "-version" : "--version";
  try {
    execFileSync(bin, [flag], { stdio: "ignore" });
    return true;
  } catch {
    console.log(`missing ${bin}: ${dependencyHint(os)}`);
    return false;
  }
}

export function main({ repoDir, home = homedir(), platform = process.platform, env = process.env, only = [] } = {}) {
  const root = repoDir || join(dirname(fileURLToPath(import.meta.url)), "..");
  const os = detectOS(platform);
  if (!nodeMeetsMinimum(process.version)) {
    console.log("node >= 18 is required, found " + process.version);
    process.exit(1);
  }
  const want = (t) => !only.length || only.includes(t);
  execSync("npm install --omit=dev --ignore-scripts", { cwd: root, stdio: "inherit" });
  checkDep("yt-dlp", os);
  checkDep("ffmpeg", os);
  const entry = join(root, "src/index.js");
  const outDir = env.YTDLP_DOWNLOAD_DIR || defaultDownloadDir(home);
  if (want("hermes")) {
    registerHermes(entry);
    linkSkill(root, home, env, [hermesSkillsDir(home, env)]);
  }
  if (want("opencode-mcp")) registerOpencode(entry, outDir, home, platform, env.APPDATA);
  if (want("opencode-plugin")) installOpencodePlugin(root, home, platform);
  if (want("gemini")) registerStdioJson(geminiConfigPath(home), entry, outDir);
  if (want("claude")) registerStdioJson(claudeConfigPath(home), entry, outDir);
  if (want("opencode-mcp") || want("gemini") || want("claude")) installSlashCommands(root, home);
  if (want("openclaw")) registerOpenclaw(entry, outDir);
  if (want("codex")) registerCodexToml(entry, outDir, home);
  if (want("cursor")) registerCursor(entry, outDir, home);
  if (want("copilot")) registerCopilot(entry, outDir, home);
  if (want("cline")) linkSkill(root, home, env, [clineSkillsDir(home)]);
  if (want("pi")) linkSkill(root, home, env, [hermesSkillsDir(home, env), piSkillsDir(home)]);
  if (want("manual") || !only.length) console.log("\n" + manualBlock(entry, outDir));
  console.log("DONE");
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) {
  const parsed = parseOnly(process.argv);
  if (parsed === null && process.stdin.isTTY) {
    promptTargets().then((picked) => main({ only: picked }));
  } else {
    main({ only: parsed === null ? [] : parsed });
  }
}
