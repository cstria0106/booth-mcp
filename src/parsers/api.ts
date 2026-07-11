import { z } from "zod";
import { BoothError } from "../errors.js";
import { redactSensitiveText } from "../privacy.js";
import type {
  ConversationDetail,
  ItemDetail,
  ItemState,
  ItemSummary,
  OrderDetail,
} from "../types.js";

const itemListSchema = z.object({
  metadata: z.object({
    page: z.number(),
    per_page: z.number(),
    next_page: z.number().nullable(),
    prev_page: z.number().nullable(),
    total_count: z.number(),
    total_pages: z.number(),
  }),
  items: z.array(
    z.object({
      id: z.number(),
      state: z.string(),
      url: z.string().optional(),
      name: z.string(),
      state_label: z.string().optional(),
    }),
  ),
});

const itemDetailSchema = z.object({
  id: z.number(),
  description: z.string().optional().default(""),
  state: z.string(),
  price: z.number().optional(),
  name: z.string(),
  page_design: z
    .object({
      modules: z.array(
        z.object({
          type: z.string().optional(),
          title: z.string().nullable().optional(),
          content: z.string().optional().default(""),
        }),
      ),
    })
    .optional(),
  created_at: z.string().optional(),
  published_at: z.string().nullable().optional(),
  tags_array: z.array(z.string()).optional().default([]),
  downloadables: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        file_size: z.number().optional(),
      }),
    )
    .optional()
    .default([]),
  url: z.string().optional(),
  category_ids: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
      }),
    )
    .optional()
    .default([]),
  variations: z
    .array(
      z.object({
        type: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
});

const lineItemSchema = z.object({
  item_name: z.string(),
  variation_name: z.string().optional(),
  price: z.number(),
  boost: z.number().optional().default(0),
  quantity: z.number(),
});

const orderSchema = z.object({
  order: z
    .object({
      id: z.number(),
      state: z.string(),
      require_shipment: z.boolean().optional().default(false),
      created_at: z.string().optional(),
      paid_at: z.string().nullable().optional(),
      completed_at: z.string().nullable().optional(),
      digital_line_items: z.array(lineItemSchema).optional().default([]),
      physical_line_items: z.array(lineItemSchema).optional().default([]),
      customer_info: z
        .object({
          identification_code: z.string().optional(),
          uuid: z.string().optional(),
        })
        .optional(),
      receivable_amount: z
        .object({
          share: z.number().optional(),
          line_item_total: z.number().optional(),
          fee: z.number().optional(),
          total_price: z.number().optional(),
          payment_type: z.string().optional(),
        })
        .optional(),
    })
    .passthrough(),
});

const conversationSchema = z.object({
  conversation: z.object({
    recipient: z.object({
      nickname: z.string().optional(),
      identification_code: z.string().optional(),
    }),
    messages: z.array(
      z.object({
        messageDate: z.string().optional(),
        messageDateIso: z.string().optional(),
        direction: z.string().optional(),
        body: z.string().optional().default(""),
      }),
    ),
  }),
});

export function parseItemsJson(
  json: unknown,
  sourceUrl: string,
  options: { state: ItemState; limit: number },
): { items: ItemSummary[]; nextPage?: number; totalCount: number } {
  const parsed = parse(itemListSchema, json, sourceUrl, "상품 목록 JSON");
  const items = parsed.items.slice(0, options.limit).map((item) => ({
    id: String(item.id),
    name: item.name,
    ...(item.url ? { url: item.url } : {}),
    state: options.state === "all" ? mapItemState(item.state) : options.state,
  }));
  return {
    items,
    ...(parsed.metadata.next_page ? { nextPage: parsed.metadata.next_page } : {}),
    totalCount: parsed.metadata.total_count,
  };
}

export function parseItemJson(json: unknown, sourceUrl: string): ItemDetail {
  const item = parse(itemDetailSchema, json, sourceUrl, "상품 상세 JSON");
  const category = item.category_ids.at(-1)?.name;
  const digital = item.downloadables.length > 0 || item.variations.some((variation) => /download|digital/iu.test(variation.type ?? ""));
  return {
    id: String(item.id),
    name: item.name,
    ...(item.url ? { url: item.url } : {}),
    state: mapItemState(item.state),
    type: digital ? "digital" : "physical",
    ...(category ? { category } : {}),
    ...(item.price !== undefined ? { priceJpy: item.price } : {}),
    ...(item.description ? { description: item.description } : {}),
    sections: (item.page_design?.modules ?? [])
      .filter((module) => module.content)
      .map((module) => ({
        ...(module.title ? { title: module.title } : {}),
        content: module.content,
      })),
    tags: item.tags_array,
    ...(item.published_at ? { publishedAt: item.published_at } : {}),
    digitalFiles: item.downloadables.map((file) => ({
      id: String(file.id),
      name: file.name,
      ...(file.file_size !== undefined ? { fileSize: file.file_size } : {}),
    })),
  };
}

export function parseOrderJson(json: unknown, sourceUrl: string): OrderDetail {
  const value = parse(orderSchema, json, sourceUrl, "주문 상세 JSON").order;
  const lineItems = [...value.digital_line_items, ...value.physical_line_items];
  const amounts = [
    value.receivable_amount?.line_item_total,
    value.receivable_amount?.fee,
    value.receivable_amount?.total_price,
    value.receivable_amount?.share,
  ].filter((amount): amount is number => amount !== undefined);
  return {
    id: String(value.id),
    state: mapOrderState(value.state),
    ...(value.created_at ? { orderedAt: value.created_at } : {}),
    ...(value.receivable_amount?.total_price !== undefined
      ? { totalAmountJpy: value.receivable_amount.total_price }
      : {}),
    itemNames: lineItems.map((item) => item.item_name),
    ...(value.customer_info?.identification_code
      ? { identificationCode: value.customer_info.identification_code }
      : {}),
    shipmentType: value.require_shipment ? "direct" : "unknown",
    displayedAmountsJpy: [...new Set(amounts)],
    customer: {
      realName: "[마스킹]",
      address: "[마스킹]",
      phone: "[마스킹]",
      email: "[마스킹]",
    },
  };
}

export function parseConversationJson(
  json: unknown,
  sourceUrl: string,
  conversationId: string,
  includeContent: boolean,
): { conversation: ConversationDetail; redactions: string[] } {
  const value = parse(conversationSchema, json, sourceUrl, "대화 상세 JSON").conversation;
  const redactions = new Set<string>();
  const messages = value.messages.map((message) => {
    const redacted = redactSensitiveText(message.body);
    redacted.redactions.forEach((entry) => redactions.add(entry));
    const incoming = /received|incoming|customer/iu.test(message.direction ?? "");
    const sentAt = message.messageDateIso ?? message.messageDate;
    return {
      ...(sentAt ? { sentAt } : {}),
      ...(incoming && value.recipient.nickname ? { senderNickname: value.recipient.nickname } : {}),
      ...(includeContent ? { content: redacted.text } : {}),
    };
  });
  const lastMessageAt = messages.at(-1)?.sentAt;
  return {
    conversation: {
      id: conversationId,
      ...(value.recipient.nickname ? { counterpartNickname: value.recipient.nickname } : {}),
      ...(value.recipient.identification_code ? { identificationCode: value.recipient.identification_code } : {}),
      ...(lastMessageAt ? { lastMessageAt } : {}),
      unread: false,
      messages,
    },
    redactions: [...redactions],
  };
}

function parse<T>(schema: z.ZodType<T>, json: unknown, sourceUrl: string, description: string): T {
  const result = schema.safeParse(json);
  if (!result.success) throw new BoothError("BOOTH_CHANGED", `${description} 구조가 변경되었습니다.`, sourceUrl);
  return result.data;
}

function mapItemState(value: string): ItemSummary["state"] {
  if (/draft/iu.test(value)) return "draft";
  if (/private|closed/iu.test(value)) return "private";
  if (/public|open/iu.test(value)) return "public";
  return "unknown";
}

function mapOrderState(value: string): OrderDetail["state"] {
  if (/unpaid/iu.test(value)) return "unpaid";
  if (/cancel/iu.test(value)) return "cancelled";
  if (/complete/iu.test(value)) return "completed";
  if (/paid/iu.test(value)) return "paid";
  return "unknown";
}
