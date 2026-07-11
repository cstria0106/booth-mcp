import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseConversations } from "../src/parsers/conversations.js";
import { parseOrders } from "../src/parsers/orders.js";
import { parseSales } from "../src/parsers/sales.js";
import { parseShopSettings } from "../src/parsers/settings.js";

const fixtureDir = new URL("./fixtures/", import.meta.url);
const fixture = (name: string): string => readFileSync(fileURLToPath(new URL(name, fixtureDir)), "utf8");
const url = (path: string): string => `https://manage.booth.pm${path}`;

describe("server-rendered BOOTH HTML parsers", () => {
  it("parses order lists while keeping nicknames and identification codes", () => {
    const result = parseOrders(fixture("orders.html"), url("/orders"), {
      state: "all",
      shipment: "all",
      page: 1,
      limit: 20,
    });
    expect(result.orders[0]).toMatchObject({
      id: "9001",
      buyerNickname: "creator-fan",
      identificationCode: "abcd1234",
    });
  });

  it("parses sales records", () => {
    const result = parseSales(fixture("sales.html"), url("/sales"), { granularity: "monthly", page: 1, limit: 20 });
    expect(result.records).toEqual([
      expect.objectContaining({ label: "2026/07", amountsJpy: [12300] }),
      expect.objectContaining({ label: "2026/06", amountsJpy: [9800] }),
    ]);
  });

  it("parses conversation list metadata", () => {
    const result = parseConversations(fixture("conversations.html"), url("/conversations"), { page: 1, limit: 20 });
    expect(result.conversations[0]).toMatchObject({ id: "abc12345", identificationCode: "feedbeef", unread: true });
  });

  it("parses non-financial shop settings", () => {
    expect(parseShopSettings(fixture("settings.html"), url("/settings"))).toMatchObject({
      shopName: "Sample Shop",
      description: "Digital assets.",
      subdomain: "sample",
      daysToShip: 3,
      immediatePaymentOnly: true,
    });
  });
});
