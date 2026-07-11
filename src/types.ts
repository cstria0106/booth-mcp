export interface ResultMeta {
  fetchedAt: string;
  sourceUrl: string;
  page?: number;
  nextPage?: number;
  redactions: string[];
}

export interface BoothResult<T> {
  data: T;
  meta: ResultMeta;
}

export type ItemState = "all" | "draft" | "public" | "private";
export type OrderState = "all" | "unpaid" | "paid" | "completed" | "cancelled";
export type ShipmentType = "all" | "direct" | "via_warehouse" | "factory_item";
export type SalesGranularity = "monthly" | "daily" | "item";

export interface AuthStatus {
  authenticated: boolean;
  shopName?: string;
  shopUrl?: string;
}

export interface Dashboard {
  shopName: string;
  shopUrl?: string;
  shopStatus: "open" | "closed" | "unknown";
  followers?: number;
  recentSalesJpy: number[];
  hasUnshippedOrders?: boolean;
}

export interface ItemSummary {
  id: string;
  name: string;
  url?: string;
  state: Exclude<ItemState, "all"> | "unknown";
}

export interface ItemDetail extends ItemSummary {
  type: "digital" | "physical" | "unknown";
  category?: string;
  priceJpy?: number;
  description?: string;
  sections: Array<{ title?: string; content: string }>;
  tags: string[];
  publishedAt?: string;
  digitalFiles: Array<{ id: string; name: string; fileSize?: number }>;
}

export interface OrderSummary {
  id: string;
  state: Exclude<OrderState, "all"> | "unknown";
  orderedAt?: string;
  totalAmountJpy?: number;
  itemNames: string[];
  buyerNickname?: string;
  identificationCode?: string;
}

export interface OrderDetail extends OrderSummary {
  shipmentType: ShipmentType | "unknown";
  displayedAmountsJpy: number[];
  customer: {
    nickname?: string;
    realName: "[마스킹]";
    address: "[마스킹]";
    phone: "[마스킹]";
    email: "[마스킹]";
  };
}

export interface SaleRecord {
  label: string;
  amountsJpy: number[];
  itemName?: string;
  href?: string;
}

export interface ConversationSummary {
  id: string;
  counterpartNickname?: string;
  identificationCode?: string;
  lastMessageAt?: string;
  unread: boolean;
  excerpt?: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: Array<{
    sentAt?: string;
    senderNickname?: string;
    content?: string;
  }>;
}

export interface ShopSettings {
  published?: boolean;
  shopName: string;
  description?: string;
  subdomain?: string;
  externalLinks: Array<{ url: string; label?: string }>;
  daysToShip?: number;
  immediatePaymentOnly?: boolean;
  messageToCustomers?: string;
}
