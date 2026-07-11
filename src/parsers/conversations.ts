import type { ConversationSummary } from "../types.js";
import { redactSensitiveText } from "../privacy.js";
import {
  assertPageMarker,
  extractIdentificationCode,
  findNextPage,
  normalizeText,
  parseDate,
  parseDocument,
} from "./common.js";

export function parseConversations(
  html: string,
  sourceUrl: string,
  options: { page: number; limit: number },
): { conversations: ConversationSummary[]; nextPage?: number; redactions: string[] } {
  const $ = parseDocument(html, sourceUrl);
  const conversationList = $("main .message-threads").first();
  assertPageMarker(conversationList.length > 0, sourceUrl, "메시지 목록");
  const conversations: ConversationSummary[] = [];
  const seen = new Set<string>();
  const redactions = new Set<string>();

  conversationList.children("a[href]").each((_index, element) => {
    if (conversations.length >= options.limit) return;
    const card = $(element);
    const href = card.attr("href") ?? "";
    const id = href.match(/^\/conversations\/([^/]+)\/messages$/u)?.[1];
    if (!id || seen.has(id)) return;
    seen.add(id);
    const context = normalizeText(card.text());
    const structuralNickname = normalizeText(
      card.find(".message-customer-name").first().clone().children().remove().end().text(),
    );
    const nickname = structuralNickname || extractCounterpart(context, id);
    const identificationCode = extractIdentificationCode(context);
    const excerptSource = normalizeText(card.children().last().text()) || context.slice(0, 300);
    const redacted = redactSensitiveText(excerptSource);
    const lastMessageAt = parseDate(context);
    redacted.redactions.forEach((entry) => redactions.add(entry));
    conversations.push({
      id,
      ...(nickname ? { counterpartNickname: nickname } : {}),
      ...(identificationCode ? { identificationCode } : {}),
      ...(lastMessageAt ? { lastMessageAt } : {}),
      unread: /(?:^|\s)(?:unread|is-unread)(?:\s|$)/iu.test(card.attr("class") ?? "") || /Unread|未読|읽지 않음/iu.test(context),
      ...(redacted.text ? { excerpt: redacted.text.slice(0, 300) } : {}),
    });
  });

  const nextPage = findNextPage($, options.page, sourceUrl);
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
