import type { SaleRecord, SalesGranularity } from "../types.js";
import { assertPageMarker, findNextPage, normalizeText, parseDocument, parseJpyValues } from "./common.js";

export function parseSales(
  html: string,
  sourceUrl: string,
  options: { granularity: SalesGranularity; page: number; limit: number },
): { records: SaleRecord[]; nextPage?: number } {
  const $ = parseDocument(html, sourceUrl);
  const mainText = normalizeText($("main").text());
  assertPageMarker(/Sales|売上|매출/iu.test(mainText), sourceUrl, "매출 페이지");
  const records: SaleRecord[] = [];
  const seen = new Set<string>();

  $("main tr, main li, main article").each((_index, element) => {
    if (records.length >= options.limit) return;
    const text = normalizeText($(element).text());
    const amountCells = $(element)
      .find("td, [class*='amount'], [class*='price']")
      .toArray()
      .flatMap((cell) => parseJpyValues(normalizeText($(cell).text())));
    const amountsJpy = amountCells.length ? [...new Set(amountCells)] : parseJpyValues(text);
    if (amountsJpy.length === 0) return;
    const href = $(element).find("a[href]").first().attr("href");
    const label = extractSaleLabel(text, options.granularity);
    const key = `${label}:${amountsJpy.join(",")}:${href ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    const itemName = options.granularity === "item" ? normalizeText($(element).find("a[href*='/items/']").first().text()) : undefined;
    records.push({
      label,
      amountsJpy,
      ...(itemName ? { itemName } : {}),
      ...(href ? { href } : {}),
    });
  });

  if (records.length === 0) {
    const amounts = parseJpyValues(mainText);
    for (const [index, amount] of amounts.slice(0, options.limit).entries()) {
      records.push({ label: `${options.granularity}-${index + 1}`, amountsJpy: [amount] });
    }
  }

  const nextPage = findNextPage($, options.page);
  return { records, ...(nextPage ? { nextPage } : {}) };
}

function extractSaleLabel(text: string, granularity: SalesGranularity): string {
  if (granularity === "monthly") return text.match(/20\d{2}[/-]\d{1,2}/u)?.[0] ?? text.slice(0, 80);
  if (granularity === "daily") return text.match(/20\d{2}[/-]\d{1,2}[/-]\d{1,2}/u)?.[0] ?? text.slice(0, 80);
  return text.slice(0, 120);
}
