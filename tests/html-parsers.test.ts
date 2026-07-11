import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BoothError } from "../src/errors.js";
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
      state: "completed",
      totalAmountJpy: 1200,
      itemNames: ["Sample Asset"],
      buyerNickname: "creator-fan",
      identificationCode: "abcd1234",
    });
    expect(result.orders).toHaveLength(2);
    expect(result.nextPage).toBe(2);
  });

  it("parses monthly sales from detail routes without collecting page-wide amounts", () => {
    const result = parseSales(fixture("sales.html"), url("/sales"), { granularity: "monthly", page: 1, limit: 20 });
    expect(result.records).toEqual([
      expect.objectContaining({ label: "2026/07", amountsJpy: [12300] }),
      expect.objectContaining({ label: "2026/06", amountsJpy: [9800] }),
    ]);
    expect(result.nextPage).toBe(2);
  });

  it("parses daily sales from the semantic report table", () => {
    const result = parseSales(fixture("sales-daily.html"), url("/sales/daily/recent"), {
      granularity: "daily",
      page: 1,
      limit: 20,
    });
    expect(result.records).toEqual([
      { label: "2026/07/02", amountsJpy: [2300] },
      { label: "2026/07/01", amountsJpy: [1100] },
    ]);
  });

  it("parses item sales from price cells", () => {
    const result = parseSales(fixture("sales-items.html"), url("/sales/items"), {
      granularity: "item",
      page: 1,
      limit: 1,
    });
    expect(result.records).toEqual([
      expect.objectContaining({ label: "Sample Asset", itemName: "Sample Asset", amountsJpy: [3600, 3000] }),
    ]);
  });

  it("parses conversation list metadata", () => {
    const result = parseConversations(fixture("conversations.html"), url("/conversations"), { page: 1, limit: 20 });
    expect(result.conversations[0]).toMatchObject({
      id: "abc12345",
      counterpartNickname: "buyer-cat",
      identificationCode: "feedbeef",
      unread: true,
      excerpt: "임의 배지문의드립니다",
    });
    expect(result.nextPage).toBe(2);
  });

  it("parses non-financial shop settings", () => {
    expect(parseShopSettings(fixture("settings.html"), url("/settings"))).toMatchObject({
      shopName: "Sample Shop",
      description: "Digital assets.",
      subdomain: "sample",
      published: true,
      externalLinks: [{ url: "https://example.com", label: "Homepage" }],
      daysToShip: 3,
      immediatePaymentOnly: true,
      messageToCustomers: "Thanks for your order!",
    });
  });

  it("accepts valid empty list containers", () => {
    expect(
      parseOrders("<main><div class='manage-orders'></div></main>", url("/orders"), {
        state: "all",
        shipment: "all",
        page: 1,
        limit: 20,
      }).orders,
    ).toEqual([]);
    expect(
      parseConversations("<main><div class='message-threads'></div></main>", url("/conversations"), {
        page: 1,
        limit: 20,
      }).conversations,
    ).toEqual([]);
  });

  it("reports BOOTH_CHANGED when a page-specific marker is missing", () => {
    expectBoothChanged(() =>
      parseSales("<main><div>12,300 JPY</div></main>", url("/sales"), {
        granularity: "monthly",
        page: 1,
        limit: 20,
      }),
    );
    expectBoothChanged(() => parseShopSettings("<main><input name='unrelated'></main>", url("/settings")));
  });
});

function expectBoothChanged(action: () => unknown): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BoothError);
    if (error instanceof BoothError) expect(error.code).toBe("BOOTH_CHANGED");
    return;
  }
  throw new Error("Expected BOOTH_CHANGED");
}
