import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const npm = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const npmArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm"] : [];
const destination = await mkdtemp(join(tmpdir(), "booth-mcp-package-"));
let client;

try {
  const packed = spawnSync(npm, [...npmArgs, "pack", "--json", "--ignore-scripts", "--pack-destination", destination], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (packed.error) throw packed.error;
  if (packed.status !== 0) throw new Error(packed.stderr || "npm pack failed");

  const archive = resolve(destination, JSON.parse(packed.stdout)[0].filename);
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const transport = new StdioClientTransport({
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["exec", "--yes", `--package=${archive}`, "--", "booth-mcp"],
    cwd: process.cwd(),
    stderr: "pipe",
  });
  client = new Client({ name: "booth-mcp-package-smoke", version: "1.0.0" });
  await client.connect(transport);

  const server = client.getServerVersion();
  if (server?.name !== "booth-mcp" || server.version !== packageJson.version) {
    throw new Error(`packaged server version mismatch: ${JSON.stringify(server)}`);
  }
  const tools = await client.listTools();
  if (tools.tools.length !== 11 || !tools.tools.some((tool) => tool.name === "booth_get_sales")) {
    throw new Error("packaged server did not expose the expected BOOTH tools");
  }

  process.stdout.write(`Packaged MCP ${server.version} initialized with ${tools.tools.length} tools.\n`);
} finally {
  await client?.close();
  await rm(destination, { recursive: true, force: true });
}
