import { describe, expect, it } from "vitest";
import { BoothService } from "../../src/service.js";

describe.runIf(process.env.BOOTH_MCP_LIVE === "1")("opt-in live smoke test", () => {
  it("reads HTML and JSON API data without launching a browser or mutating BOOTH", async () => {
    const service = new BoothService();
    try {
      const auth = await service.authStatus();
      expect(auth.data.authenticated).toBe(true);
      expect((await service.dashboard()).data.shopName.length).toBeGreaterThan(0);
      const items = await service.listItems({ limit: 1 });
      expect(items.data.items.length).toBeLessThanOrEqual(1);
      const firstItem = items.data.items[0];
      if (firstItem) expect((await service.getItem(firstItem.id)).data.id).toBe(firstItem.id);

      const orders = await service.listOrders({ limit: 1 });
      const firstOrder = orders.data.orders[0];
      if (firstOrder) expect((await service.getOrder(firstOrder.id)).data.id).toBe(firstOrder.id);

      const conversations = await service.listConversations({ limit: 1 });
      const firstConversation = conversations.data.conversations[0];
      if (firstConversation) {
        expect((await service.getConversation(firstConversation.id, false)).data.id).toBe(firstConversation.id);
      }
    } finally {
      await service.close();
    }
  }, 30_000);
});
