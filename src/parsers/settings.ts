import type { ShopSettings } from "../types.js";
import { assertPageMarker, normalizeText, parseDocument, valueOfFirst } from "./common.js";

export function parseShopSettings(html: string, sourceUrl: string): ShopSettings {
  const $ = parseDocument(html, sourceUrl);
  assertPageMarker(
    $("main a[href='/shipping_costs'], main a[href='/payout_account']").length > 0,
    sourceUrl,
    "샵 설정",
  );
  const parsedShopName = valueOfFirst($, [
      "main input[aria-label*='Shop Name']",
      "main input[name*='shop'][name*='name']",
      "main input[placeholder*='shop name' i]",
    ]);
  assertPageMarker(Boolean(parsedShopName), sourceUrl, "샵 설정 입력 필드");
  const shopName = parsedShopName ?? "unknown";
  const description = valueOfFirst($, [
    "main textarea[aria-label='Description']",
    "main textarea[name*='description']",
    "main textarea[placeholder*='description' i]",
  ]);
  const subdomain = valueOfFirst($, ["main input[aria-label='Subdomain']", "main input[name*='subdomain']"]);
  const daysText = valueOfFirst($, [
    "main input[aria-label*='Days']",
    "main input[aria-label*='발송 소요']",
    "main input[name*='days_to_ship']",
  ]);
  const daysToShip = daysText ? Number(daysText) : undefined;
  const textareas = $("main textarea").toArray();
  const messageToCustomers = textareas.length > 1 ? normalizeText($(textareas.at(-1)).text()) : undefined;
  const checkboxes = $("main input[type='checkbox']").toArray();
  const externalLinks: Array<{ url: string; label?: string }> = [];

  $("main input[type='url'], main input[aria-label='https://']").each((_index, element) => {
    const url = $(element).attr("value")?.trim();
    if (!url || !/^https?:\/\//u.test(url)) return;
    const container = $(element).parent().parent();
    const labelInput = container.find("input[type='text']").filter((_i, input) => input !== element).first();
    const label = labelInput.attr("value")?.trim();
    externalLinks.push({ url, ...(label ? { label } : {}) });
  });

  const immediatePaymentOnly = checkboxes.some((checkbox) => {
    const context = normalizeText($(checkbox).parent().text());
    return /immediate payment|すぐに支払|바로 결제/iu.test(context) && $(checkbox).is(":checked");
  });
  const publishedCheckbox = checkboxes.find((checkbox) => /公開|공개|publish/iu.test(normalizeText($(checkbox).parent().text())));

  return {
    ...(publishedCheckbox ? { published: $(publishedCheckbox).is(":checked") } : {}),
    shopName,
    ...(description ? { description } : {}),
    ...(subdomain ? { subdomain } : {}),
    externalLinks,
    ...(daysToShip !== undefined && Number.isFinite(daysToShip) ? { daysToShip } : {}),
    immediatePaymentOnly,
    ...(messageToCustomers && messageToCustomers !== description ? { messageToCustomers } : {}),
  };
}
