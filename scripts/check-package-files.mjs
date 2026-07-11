import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const npmArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm"] : [];
const result = spawnSync(npm, [...npmArgs, "pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "npm pack failed\n");
  process.exit(result.status ?? 1);
}

const pack = JSON.parse(result.stdout)[0];
const paths = new Set(pack.files.map((file) => file.path));
const required = [
  "dist/cli.js",
  ".codex-plugin/plugin.json",
  ".mcp.json",
  "skills/booth/SKILL.md",
  "skills/booth/agents/openai.yaml",
];
const missing = required.filter((path) => !paths.has(path));
if (missing.length > 0) throw new Error(`npm package is missing: ${missing.join(", ")}`);

process.stdout.write(`npm package contains all ${required.length} required plugin files.\n`);
