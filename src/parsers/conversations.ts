import type { ConversationSummary } from "../types.js";
import { redactSensitiveText } from "../privacy.js";
import {
  assertPageMarker,
  extractIdentificationCode,
  findNextPage,
  normalizeText,
  parseDate,
  parseDocument,
  textAround,
} from "./common.js";

export function parseConversations(
  html: string,
  sourceUrl: string,
  options: { page: number; limit: number },
): { conversations: ConversationSummary[]; nextPage?: number; redactions: string[] } {
  const $ = parseDocument(html, sourceUrl);
  const mainText = normalizeText($("main").text());
  assertPageMarker(/Messages List|メッセージ|메시지/iu.test(mainText), sourceUrl, "메시지 목록");
  const conversations: ConversationSummary[] = [];
  const seen = new Set<string>();
  const redactions = new Set<string>();

  $("main a[href*='/conversations/'][href$='/messages']").each((_index, element) => {
    if (conversations.length >= options.limit) return;
    const href = $(element).attr("href") ?? "";
    const id = href.match(/\/conversations\/([^/]+)\/messages/u)?.[1];
    if (!id || seen.has(id)) return;
    seen.add(id);
    const context = textAround($, `main a[href='${href}']`, 7);
    const nickname = extractCounterpart(context, id);
    const identificationCode = extractIdentificationCode(context);
    const excerptSource = normalizeText($(element).text()) || context.slice(0, 300);
    const redacted = redactSensitiveText(excerptSource);
    const lastMessageAt = parseDate(context);
    redacted.redactions.forEach((entry) => redactions.add(entry));
    conversations.push({
      id,
      ...(nickname ? { counterpartNickname: nickname } : {}),
      ...(identificationCode ? { identificationCode } : {}),
      ...(lastMessageAt ? { lastMessageAt } : {}),
      unread: /Unread|未読|읽지 않음/iu.test(context),
      ...(redacted.text ? { excerpt: redacted.text.slice(0, 300) } : {}),
    });
  });

  const nextPage = findNextPage($, options.page);
  return { conversations, ...(nextPage ? { nextPage } : {}), redactions: [...redactions] };
}

function extractCounterpart(text: string, id: string): string | undefined {
  const withoutKnownMetadata = text
    .replace(new RegExp(id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "gu"), "")
    .replace(/(?:Identification Code|識別コード|식별 코드)\s*[:：]\s*[\w-]+/giu, "")
    .trim();
  const explicit = withoutKnownMetadata.match(/(?:Nickname|ユーザー名|닉네임)\s*[:：]\s*([^|]{1,80})/iu)?.[1];
  return explicit?.trim();
}
