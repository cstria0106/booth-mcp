import type { OrderState, OrderSummary, ShipmentType } from "../types.js";
import {
  assertPageMarker,
  extractIdentificationCode,
  findNextPage,
  inferOrderState,
  normalizeText,
  parseDate,
  parseDocument,
  parseJpyValues,
  textAround,
} from "./common.js";

export function parseOrders(
  html: string,
  sourceUrl: string,
  options: { state: OrderState; shipment: ShipmentType; page: number; limit: number },
): { orders: OrderSummary[]; nextPage?: number } {
  const $ = parseDocument(html, sourceUrl);
  assertPageMarker($("main a[href*='state=unpaid'], main a[href='/orders/csv']").length > 0, sourceUrl, "주문 목록");
  const seen = new Set<string>();
  const orders: OrderSummary[] = [];

  $("main a[href^='/orders/']").each((_index, element) => {
    const href = $(element).attr("href") ?? "";
    const id = href.match(/^\/orders\/(\d+)$/u)?.[1];
    if (!id || seen.has(id) || orders.length >= options.limit) return;
    seen.add(id);
    const context = textAround($, `main a[href='${href}']`, 7);
    const itemNames = new Set<string>();
    let container = $(element).parent();
    for (let level = 0; level < 6; level += 1) {
      container.find("a[href*='/items/']").each((_itemIndex, item) => {
        const name = normalizeText($(item).text());
        if (name) itemNames.add(name);
      });
      if (itemNames.size > 0) break;
      container = container.parent();
    }
    const nickname = extractNickname(context);
    const identificationCode = extractIdentificationCode(context);
    const amounts = parseJpyValues(context);
    const orderedAt = parseDate(context);
    orders.push({
      id,
      state: options.state === "all" ? inferOrderState(context) : options.state,
      ...(orderedAt ? { orderedAt } : {}),
      ...(amounts.length ? { totalAmountJpy: Math.max(...amounts) } : {}),
      itemNames: [...itemNames],
      ...(nickname ? { buyerNickname: nickname } : {}),
      ...(identificationCode ? { identificationCode } : {}),
    });
  });

  const nextPage = findNextPage($, options.page);
  return { orders, ...(nextPage ? { nextPage } : {}) };
}

function extractNickname(text: string): string | undefined {
  const match = text.match(/(?:Nickname|ユーザー名|닉네임)\s*[:：]\s*(.{1,80}?)(?=\s*(?:Identification Code|識別コード|식별 코드|20\d{2}[/-]|\d[\d,]*\s*JPY|$))/iu);
  return match?.[1]?.trim();
}
