import { describe, expect, it } from "vitest";
import { getLoginBrowserCandidates } from "../src/browser/client.js";

describe("login browser selection", () => {
  it("uses installed Chrome and Edge channels without a bundled browser", () => {
    expect(getLoginBrowserCandidates({})).toEqual([
      { label: "Google Chrome", channel: "chrome" },
      { label: "Microsoft Edge", channel: "msedge" },
    ]);
  });

  it("prefers an explicitly configured Chromium executable", () => {
    expect(getLoginBrowserCandidates({ BOOTH_MCP_BROWSER_PATH: "/opt/browser/chrome" })[0]).toEqual({
      label: "BOOTH_MCP_BROWSER_PATH",
      executablePath: "/opt/browser/chrome",
    });
  });
});
