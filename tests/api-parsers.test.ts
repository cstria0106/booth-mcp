import { describe, expect, it } from "vitest";
import { parseConversationJson, parseItemJson, parseItemsJson, parseOrderJson } from "../src/parsers/api.js";

describe("BOOTH JSON API parsers", () => {
  it("parses the item list API", () => {
    const result = parseItemsJson(
      {
        metadata: { page: 1, per_page: 20, next_page: 2, prev_page: null, total_count: 21, total_pages: 2 },
        items: [{ id: 100, state: "public", url: "https://sample.booth.pm/items/100", name: "Sample Asset" }],
      },
      "https://manage.booth.pm/items.json",
      { state: "all", limit: 20 },
    );
    expect(result).toEqual({
      items: [{ id: "100", state: "public", url: "https://sample.booth.pm/items/100", name: "Sample Asset" }],
      nextPage: 2,
      totalCount: 21,
    });
  });

  it("parses item details without exposing downloadable URLs", () => {
    const result = parseItemJson(
      {
        id: 100,
        description: "Description",
        state: "public",
        price: 1200,
        name: "Sample Asset",
        page_design: { modules: [{ type: "text", title: "License", content: "Personal use" }] },
        published_at: "2026-07-01T00:00:00Z",
        tags_array: ["Unity"],
        downloadables: [{ id: 99, name: "sample.zip", file_size: 1234, url: "https://signed.example/file" }],
        url: "https://sample.booth.pm/items/100",
        category_ids: [{ id: 1, name: "3D Tools" }],
        variations: [{ type: "download" }],
      },
      "https://manage.booth.pm/items/100",
    );
    expect(result.digitalFiles).toEqual([{ id: "99", name: "sample.zip", fileSize: 1234 }]);
    expect(JSON.stringify(result)).not.toContain("signed.example");
  });

  it("parses order detail and keeps the identification code", () => {
    const result = parseOrderJson(
      {
        order: {
          id: 9001,
          state: "completed",
          require_shipment: false,
          created_at: "2026-07-01T00:00:00Z",
          digital_line_items: [{ item_name: "Sample Asset", price: 1200, quantity: 1 }],
          customer_info: { identification_code: "abcd1234", uuid: "private-uuid" },
          receivable_amount: { line_item_total: 1200, fee: 100, total_price: 1200, share: 1100 },
        },
      },
      "https://api.booth.pm/frontend/manage/orders/9001.json",
    );
    expect(result).toMatchObject({ id: "9001", state: "completed", identificationCode: "abcd1234" });
    expect(JSON.stringify(result)).not.toContain("private-uuid");
  });

  it("parses conversation details and exposes nicknames while redacting contacts", () => {
    const result = parseConversationJson(
      {
        conversation: {
          recipient: { nickname: "buyer-cat", identification_code: "feedbeef" },
          messages: [
            {
              messageDate: "2026/07/02",
              messageDateIso: "2026-07-02T00:00:00Z",
              direction: "incoming",
              body: "test@example.com 090-1234-5678",
            },
          ],
        },
      },
      "https://api.booth.pm/frontend/manage/conversations/abc",
      "abc",
      true,
    );
    expect(result.conversation.counterpartNickname).toBe("buyer-cat");
    expect(result.conversation.messages[0]?.content).toContain("[이메일 마스킹]");
    expect(result.redactions).toEqual(expect.arrayContaining(["email", "phone"]));
  });
});
