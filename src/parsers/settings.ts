import type { ShopSettings } from "../types.js";
import { assertPageMarker, parseDocument, valueOfFirst } from "./common.js";

export function parseShopSettings(html: string, sourceUrl: string): ShopSettings {
  const $ = parseDocument(html, sourceUrl);
  assertPageMarker(
    $("main form input[name='shop[name]']").length > 0,
    sourceUrl,
    "샵 설정",
  );
  const parsedShopName = valueOfFirst($, ["main input[name='shop[name]']"]);
  assertPageMarker(Boolean(parsedShopName), sourceUrl, "샵 설정 입력 필드");
  const shopName = parsedShopName ?? "unknown";
  const description = valueOfFirst($, ["main textarea[name='shop[description]']"]);
  const subdomain = valueOfFirst($, ["main input[name='shop[subdomain]']"]);
  const daysText = valueOfFirst($, ["main input[name='shop[days_to_ship]']"]);
  const daysToShip = daysText ? Number(daysText) : undefined;
  const messageToCustomers = valueOfFirst($, ["main textarea[name='shop[thank_you_message_attributes][body]']"]);
  const externalLinks: Array<{ url: string; label?: string }> = [];

  $("main input[name^='shop[websites_attributes]'][name$='[url]']").each((_index, element) => {
    const url = $(element).attr("value")?.trim();
    if (!url || !/^https?:\/\//u.test(url)) return;
    const index = $(element).attr("name")?.match(/^shop\[websites_attributes\]\[(\d+)\]\[url\]$/u)?.[1];
    const label = index
      ? $(`main input[name='shop[websites_attributes][${index}][label]']`).attr("value")?.trim()
      : undefined;
    externalLinks.push({ url, ...(label ? { label } : {}) });
  });

  const immediatePaymentOnly = $("main input[type='checkbox'][name='force_immediately_payment_method']").is(":checked");
  const publishedCheckbox = $("main input[type='checkbox'][name='shop[open]']").first();

  return {
    ...(publishedCheckbox.length ? { published: publishedCheckbox.is(":checked") } : {}),
    shopName,
    ...(description ? { description } : {}),
    ...(subdomain ? { subdomain } : {}),
    externalLinks,
    ...(daysToShip !== undefined && Number.isFinite(daysToShip) ? { daysToShip } : {}),
    immediatePaymentOnly,
    ...(messageToCustomers && messageToCustomers !== description ? { messageToCustomers } : {}),
  };
}
