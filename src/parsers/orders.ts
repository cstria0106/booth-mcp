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
} from "./common.js";

export function parseOrders(
  html: string,
  sourceUrl: string,
  options: { state: OrderState; shipment: ShipmentType; page: number; limit: number },
): { orders: OrderSummary[]; nextPage?: number } {
  const $ = parseDocument(html, sourceUrl);
  const orderList = $("main .manage-orders").first();
  assertPageMarker(orderList.length > 0, sourceUrl, "주문 목록");
  const seen = new Set<string>();
  const orders: OrderSummary[] = [];

  orderList.children(".manage-list-table").each((_index, element) => {
    if (orders.length >= options.limit) return;
    const card = $(element);
    const orderLink = card
      .find("a[href^='/orders/']")
      .filter((_linkIndex, link) => /^\/orders\/\d+$/u.test($(link).attr("href") ?? ""))
      .first();
    const href = orderLink.attr("href") ?? "";
    const id = href.match(/^\/orders\/(\d+)$/u)?.[1];
    if (!id || seen.has(id) || orders.length >= options.limit) return;
    seen.add(id);
    const context = normalizeText(card.text());
    const itemNames = new Set<string>();
    card.find(".manage-order-content .u-text-wrap > b, a[href*='/items/']").each((_itemIndex, item) => {
      const name = normalizeText($(item).text());
      if (name) itemNames.add(name);
    });
    const nickname = extractNickname(context);
    const identificationCode = extractIdentificationCode(context);
    const amounts = parseJpyValues(context);
    const orderedAt = parseDate(context);
    const stateContext = `${card.find(".badge").attr("class") ?? ""} ${card.find(".badge").text()} ${context}`;
    orders.push({
      id,
      state: options.state === "all" ? inferOrderState(stateContext) : options.state,
      ...(orderedAt ? { orderedAt } : {}),
      ...(amounts.length ? { totalAmountJpy: Math.max(...amounts) } : {}),
      itemNames: [...itemNames],
      ...(nickname ? { buyerNickname: nickname } : {}),
      ...(identificationCode ? { identificationCode } : {}),
    });
  });

  const nextPage = findNextPage($, options.page, sourceUrl);
  return { orders, ...(nextPage ? { nextPage } : {}) };
}

function extractNickname(text: string): string | undefined {
  const match = text.match(/(?:Nickname|ユーザー名|닉네임)\s*[:：]\s*(.{1,80}?)(?=\s*(?:Identification Code|識別コード|식별 코드|20\d{2}[/-]|\d[\d,]*\s*JPY|$))/iu);
  return match?.[1]?.trim();
}
