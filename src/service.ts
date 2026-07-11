import { BoothHttpClient } from "./browser/http-client.js";
import type { BoothReader } from "./browser/reader.js";
import { BoothError } from "./errors.js";
import { parseConversationJson, parseItemJson, parseItemsJson, parseOrderJson } from "./parsers/api.js";
import { parseConversations } from "./parsers/conversations.js";
import { parseOrders } from "./parsers/orders.js";
import { parseSales } from "./parsers/sales.js";
import { parseShopSettings } from "./parsers/settings.js";
import type {
  AuthStatus,
  BoothResult,
  ConversationDetail,
  ConversationSummary,
  Dashboard,
  ItemDetail,
  ItemState,
  ItemSummary,
  OrderDetail,
  OrderState,
  OrderSummary,
  SaleRecord,
  SalesGranularity,
  ShipmentType,
  ShopSettings,
} from "./types.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export class BoothService {
  constructor(private readonly browser: BoothReader = new BoothHttpClient()) {}

  async close(): Promise<void> {
    await this.browser.close();
  }

  async authStatus(): Promise<BoothResult<AuthStatus>> {
    try {
      const settings = await this.getShopSettings();
      const shopUrl = settings.data.subdomain ? `https://${settings.data.subdomain}.booth.pm/` : undefined;
      return wrap(
        {
          authenticated: true,
          shopName: settings.data.shopName,
          ...(shopUrl ? { shopUrl } : {}),
        },
        settings.meta.sourceUrl,
      );
    } catch (error) {
      if (error instanceof BoothError && error.code === "AUTH_REQUIRED") {
        return wrap({ authenticated: false }, "https://manage.booth.pm/");
      }
      throw error;
    }
  }

  async dashboard(): Promise<BoothResult<Dashboard>> {
    const settings = await this.getShopSettings();
    const sales = await this.getSales({ granularity: "monthly", limit: 2 });
    const recentSalesJpy = sales.data.records.flatMap((record) => record.amountsJpy).slice(0, 6);
    return wrap(
      {
        shopName: settings.data.shopName,
        ...(settings.data.subdomain ? { shopUrl: `https://${settings.data.subdomain}.booth.pm/` } : {}),
        shopStatus: settings.data.published === true ? "open" : settings.data.published === false ? "closed" : "unknown",
        recentSalesJpy,
      },
      settings.meta.sourceUrl,
    );
  }

  async listItems(input: { state?: ItemState | undefined; page?: number | undefined; limit?: number | undefined }): Promise<BoothResult<{ items: ItemSummary[] }>> {
    const state = input.state ?? "all";
    const page = normalizePage(input.page);
    const limit = normalizeLimit(input.limit);
    const params = new URLSearchParams();
    if (state !== "all") params.set("state", state);
    if (page > 1) params.set("page", String(page));
    const path = `/items.json${params.size ? `?${params.toString()}` : ""}`;
    const result = await this.browser.readJson(path, (json, url) => parseItemsJson(json, url, { state, limit }));
    return wrap(
      { items: result.data.items },
      result.url,
      { page, ...(result.data.nextPage ? { nextPage: result.data.nextPage } : {}) },
    );
  }

  async getItem(itemId: string): Promise<BoothResult<ItemDetail>> {
    assertNumericId(itemId, "상품");
    const result = await this.browser.readJson(`/items/${itemId}`, parseItemJson, {
      csrfFrom: `/items/${itemId}/edit`,
    });
    return wrap(result.data, result.url);
  }

  async listOrders(input: {
    state?: OrderState | undefined;
    shipment?: ShipmentType | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  }): Promise<BoothResult<{ orders: OrderSummary[] }>> {
    const state = input.state ?? "all";
    const shipment = input.shipment ?? "all";
    const page = normalizePage(input.page);
    const limit = normalizeLimit(input.limit);
    const params = new URLSearchParams();
    if (state !== "all") params.set("state", state);
    if (shipment !== "all") params.set("shipment", shipment);
    if (page > 1) params.set("page", String(page));
    const path = `/orders${params.size ? `?${params.toString()}` : ""}`;
    const result = await this.browser.read(path, (html, url) => parseOrders(html, url, { state, shipment, page, limit }));
    return wrap(
      { orders: result.data.orders },
      result.url,
      { page, ...(result.data.nextPage ? { nextPage: result.data.nextPage } : {}) },
    );
  }

  async getOrder(orderId: string): Promise<BoothResult<OrderDetail>> {
    assertNumericId(orderId, "주문");
    const result = await this.browser.readJson(`/frontend/manage/orders/${orderId}.json`, parseOrderJson, {
      origin: "https://api.booth.pm",
      csrfFrom: `/orders/${orderId}`,
    });
    return wrap(result.data, result.url, {
      redactions: ["customer.realName", "customer.address", "customer.phone", "customer.email"],
    });
  }

  async getSales(input: {
    granularity?: SalesGranularity | undefined;
    page?: number | undefined;
    limit?: number | undefined;
  }): Promise<BoothResult<{ records: SaleRecord[]; granularity: SalesGranularity }>> {
    const granularity = input.granularity ?? "monthly";
    const page = normalizePage(input.page);
    const limit = normalizeLimit(input.limit);
    const basePath = granularity === "monthly" ? "/sales" : granularity === "daily" ? "/sales/daily/recent" : "/sales/items";
    const path = page > 1 ? `${basePath}?page=${page}` : basePath;
    const result = await this.browser.read(path, (html, url) => parseSales(html, url, { granularity, page, limit }));
    return wrap(
      { records: result.data.records, granularity },
      result.url,
      { page, ...(result.data.nextPage ? { nextPage: result.data.nextPage } : {}) },
    );
  }

  async listConversations(input: { page?: number | undefined; limit?: number | undefined }): Promise<BoothResult<{ conversations: ConversationSummary[] }>> {
    const page = normalizePage(input.page);
    const limit = normalizeLimit(input.limit);
    const path = page > 1 ? `/conversations?page=${page}` : "/conversations";
    const result = await this.browser.read(path, (html, url) => parseConversations(html, url, { page, limit }));
    return wrap(
      { conversations: result.data.conversations },
      result.url,
      {
        page,
        ...(result.data.nextPage ? { nextPage: result.data.nextPage } : {}),
        redactions: result.data.redactions,
      },
    );
  }

  async getConversation(conversationId: string, includeContent = false): Promise<BoothResult<ConversationDetail>> {
    if (!/^[\w-]{4,128}$/u.test(conversationId)) throw new BoothError("NOT_FOUND", "올바른 대화 ID가 아닙니다.");
    const encodedId = encodeURIComponent(conversationId);
    const path = `/frontend/manage/conversations/${encodedId}`;
    const result = await this.browser.readJson(
      path,
      (json, url) => parseConversationJson(json, url, conversationId, includeContent),
      {
        origin: "https://api.booth.pm",
        csrfFrom: `/conversations/${encodedId}/messages`,
      },
    );
    return wrap(result.data.conversation, result.url, { redactions: result.data.redactions });
  }

  async getShopSettings(): Promise<BoothResult<ShopSettings>> {
    const result = await this.browser.read("/settings", parseShopSettings);
    return wrap(result.data, result.url, { redactions: ["payoutAccount", "sellerLegalInfo"] });
  }
}

function wrap<T>(
  data: T,
  sourceUrl: string,
  extra: { page?: number; nextPage?: number; redactions?: string[] } = {},
): BoothResult<T> {
  return {
    data,
    meta: {
      fetchedAt: new Date().toISOString(),
      sourceUrl,
      redactions: extra.redactions ?? [],
      ...(extra.page !== undefined ? { page: extra.page } : {}),
      ...(extra.nextPage !== undefined ? { nextPage: extra.nextPage } : {}),
    },
  };
}

function normalizePage(page: number | undefined): number {
  return page && Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizeLimit(limit: number | undefined): number {
  if (!limit || !Number.isInteger(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

function assertNumericId(id: string, label: string): void {
  if (!/^\d+$/u.test(id)) throw new BoothError("NOT_FOUND", `올바른 ${label} ID가 아닙니다.`);
}
