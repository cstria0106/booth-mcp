import type { SaleRecord, SalesGranularity } from "../types.js";
import { assertPageMarker, findNextPage, normalizeText, parseDocument, parseJpyValues } from "./common.js";

export function parseSales(
  html: string,
  sourceUrl: string,
  options: { granularity: SalesGranularity; page: number; limit: number },
): { records: SaleRecord[]; nextPage?: number } {
  const $ = parseDocument(html, sourceUrl);
  assertPageMarker(
    $("main a[href='/sales'], main a[href='/sales/daily/recent'], main a[href='/sales/items']").length >= 2,
    sourceUrl,
    "매출 페이지",
  );
  const records: SaleRecord[] = [];
  const seen = new Set<string>();

  const candidates = salesCandidates($, options.granularity);
  candidates.each((_index, element) => {
    if (records.length >= options.limit) return;
    const candidate = $(element);
    const record = options.granularity === "monthly" ? monthlyRecord($, candidate) : candidate;
    const text = normalizeText(record.text());
    const amountCells = record
      .find("td.number, td.price, [class*='amount'], [class*='price']")
      .toArray()
      .flatMap((cell) => parseJpyValues(normalizeText($(cell).text())));
    const amountsJpy = [...new Set(amountCells.length ? amountCells : parseJpyValues(text))];
    if (amountsJpy.length === 0) return;
    const href = options.granularity === "monthly" ? candidate.attr("href") : undefined;
    const itemName = options.granularity === "item" ? normalizeText(record.children("td").first().text()) : undefined;
    const label = itemName || extractSaleLabel(text, options.granularity, href);
    const key = `${label}:${amountsJpy.join(",")}:${href ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    records.push({
      label,
      amountsJpy,
      ...(itemName ? { itemName } : {}),
      ...(href ? { href } : {}),
    });
  });

  const nextPage = findNextPage($, options.page, sourceUrl);
  return { records, ...(nextPage ? { nextPage } : {}) };
}

function salesCandidates($: ReturnType<typeof parseDocument>, granularity: SalesGranularity) {
  if (granularity === "monthly") {
    return $("main a[href^='/sales/']").filter((_index, element) =>
      /^\/sales\/20\d{2}\/\d{1,2}$/u.test($(element).attr("href") ?? ""),
    );
  }
  if (granularity === "daily") return $("main table.sales-report.daily tr:has(td)");
  return $("main table tr:has(td.price)");
}

function monthlyRecord($: ReturnType<typeof parseDocument>, link: ReturnType<ReturnType<typeof parseDocument>>) {
  let node = link.parent();
  while (node.length > 0 && !node.is("main")) {
    if (parseJpyValues(normalizeText(node.text())).length > 0) return node;
    node = node.parent();
  }
  return link;
}

function extractSaleLabel(text: string, granularity: SalesGranularity, href?: string): string {
  if (granularity === "monthly" && href) {
    const match = href.match(/^\/sales\/(20\d{2})\/(\d{1,2})$/u);
    if (match) return `${match[1]}/${match[2]?.padStart(2, "0")}`;
  }
  if (granularity === "monthly") return text.match(/20\d{2}[/-]\d{1,2}/u)?.[0] ?? text.slice(0, 80);
  if (granularity === "daily") return text.match(/20\d{2}[/-]\d{1,2}[/-]\d{1,2}/u)?.[0] ?? text.slice(0, 80);
  return text.slice(0, 120);
}
