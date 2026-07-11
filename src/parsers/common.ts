import { load, type CheerioAPI } from "cheerio";
import { BoothError } from "../errors.js";

export function parseDocument(html: string, sourceUrl: string): CheerioAPI {
  const $ = load(html);
  if ($("main").length === 0) {
    throw new BoothError("BOOTH_CHANGED", "BOOTH 페이지의 main 영역을 찾을 수 없습니다.", sourceUrl);
  }
  return $;
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function parseJpyValues(value: string): number[] {
  const values: number[] = [];
  const patterns = [/(\d[\d,]*)\s*JPY/giu, /[¥￥]\s*(\d[\d,]*)/gu];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const parsed = Number((match[1] ?? "").replaceAll(",", ""));
      if (Number.isFinite(parsed)) values.push(parsed);
    }
  }
  return [...new Set(values)];
}

export function parseDate(value: string): string | undefined {
  const match = value.match(/\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/u);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  const date = `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}`;
  if (!hour || !minute) return date;
  return `${date}T${hour.padStart(2, "0")}:${minute}:${second ?? "00"}`;
}

export function parsePageFromHref(href: string | undefined): number | undefined {
  if (!href) return undefined;
  try {
    const page = Number(new URL(href, "https://manage.booth.pm").searchParams.get("page"));
    return Number.isInteger(page) && page > 0 ? page : undefined;
  } catch {
    return undefined;
  }
}

export function findNextPage($: CheerioAPI, currentPage: number, sourceUrl: string): number | undefined {
  const expectedPathname = new URL(sourceUrl).pathname;
  const relNextHref = $("main a[rel='next']").attr("href");
  const relNext = hasPathname(relNextHref, expectedPathname) ? parsePageFromHref(relNextHref) : undefined;
  if (relNext) return relNext;
  let nextPage: number | undefined;
  $("main a[href*='page=']").each((_index, element) => {
    const href = $(element).attr("href");
    if (!hasPathname(href, expectedPathname)) return;
    const candidate = parsePageFromHref(href);
    if (candidate === currentPage + 1) nextPage = candidate;
  });
  return nextPage;
}

function hasPathname(href: string | undefined, expectedPathname: string): boolean {
  if (!href) return false;
  try {
    return new URL(href, "https://manage.booth.pm").pathname === expectedPathname;
  } catch {
    return false;
  }
}

export function valueOfFirst($: CheerioAPI, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length === 0) continue;
    const value = element.attr("value") ?? element.text();
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return undefined;
}

export function assertPageMarker(condition: boolean, sourceUrl: string, description: string): void {
  if (!condition) {
    throw new BoothError("BOOTH_CHANGED", `${description} 구조를 인식할 수 없습니다.`, sourceUrl);
  }
}

export function inferItemState(text: string): "draft" | "public" | "private" | "unknown" {
  if (/\bDraft\b|下書き|초안/iu.test(text)) return "draft";
  if (/\bPrivate\b|非公開|비공개/iu.test(text)) return "private";
  if (/Public|公開中|공개/iu.test(text)) return "public";
  return "unknown";
}

export function inferOrderState(text: string): "unpaid" | "paid" | "completed" | "cancelled" | "unknown" {
  if (/Unpaid|未払い|미결제/iu.test(text)) return "unpaid";
  if (/Cancelled|キャンセル|취소/iu.test(text)) return "cancelled";
  if (/Completed|完了|완료/iu.test(text)) return "completed";
  if (/Paid|支払済|결제 완료/iu.test(text)) return "paid";
  return "unknown";
}

export function extractIdentificationCode(text: string): string | undefined {
  const token = text.match(/(?:Identification Code|識別コード|식별 코드)\s*[:：]\s*([^\s|]{1,64})/iu)?.[1];
  if (!token) return undefined;
  return token.match(/^[0-9a-f]{8}/iu)?.[0] ?? token;
}
