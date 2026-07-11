import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { createServer } from "../src/server.js";

describe("booth_login", () => {
  it("waits for login and returns a structured success result", async () => {
    const login = vi.fn(async () => Promise.resolve());
    const { server, service } = createServer(undefined, login);
    const client = new Client({ name: "booth-login-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const result = await client.callTool({ name: "booth_login", arguments: {} });
      expect(login).toHaveBeenCalledOnce();
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        data: { authenticated: true },
        meta: { sourceUrl: "https://manage.booth.pm/", redactions: [] },
      });
    } finally {
      await client.close();
      await server.close();
      await service.close();
    }
  });
});
