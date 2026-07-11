import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { runInteractiveLogin } from "./browser/client.js";
import { asBoothError } from "./errors.js";
import { BoothService } from "./service.js";

export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const LOGIN_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

const resultOutputShape = {
  data: z.unknown(),
  meta: z.object({
    fetchedAt: z.string(),
    sourceUrl: z.string(),
    page: z.number().optional(),
    nextPage: z.number().optional(),
    redactions: z.array(z.string()),
  }),
};

export function createServer(
  service = new BoothService(),
  login: () => Promise<void> = runInteractiveLogin,
): { server: McpServer; service: BoothService } {
  const server = new McpServer(
    { name: "booth-mcp", version: "0.1.0" },
    {
      instructions:
        "BOOTH 판매자 정보를 읽기 전용으로 조회합니다. 변경·다운로드·CSV 발행·지급 관련 작업은 제공하지 않습니다. AUTH_REQUIRED가 반환되면 사용자에게 알린 뒤 booth_login을 호출해 브라우저 로그인을 기다릴 수 있습니다.",
    },
  );

  register(
    server,
    "booth_login",
    "시스템 Chrome 또는 Edge를 열고 사용자가 BOOTH 로그인을 완료할 때까지 최대 10분 기다린 뒤 로컬 세션을 저장합니다. BOOTH 계정 데이터는 변경하지 않습니다.",
    {},
    async () => {
      await login();
      await service.close();
      return {
        data: { authenticated: true },
        meta: {
          fetchedAt: new Date().toISOString(),
          sourceUrl: "https://manage.booth.pm/",
          redactions: [],
        },
      };
    },
    LOGIN_ANNOTATIONS,
  );
  register(server, "booth_auth_status", "BOOTH 판매자 로그인 상태와 샵 식별 정보를 확인합니다.", {}, () => service.authStatus());
  register(server, "booth_get_dashboard", "샵 설정과 매출 데이터를 조합해 판매 상태와 최근 매출 요약을 조회합니다.", {}, () => service.dashboard());
  register(
    server,
    "booth_list_items",
    "판매 상품을 공개 상태별로 페이지 조회합니다.",
    {
      state: z.enum(["all", "draft", "public", "private"]).optional(),
      page: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    (input) => service.listItems(input),
  );
  register(
    server,
    "booth_get_item",
    "상품 상세, 설명, 가격, 태그와 디지털 파일 메타데이터를 조회합니다. 파일은 다운로드하지 않습니다.",
    { itemId: z.string().regex(/^\d+$/u) },
    ({ itemId }) => service.getItem(itemId),
  );
  register(
    server,
    "booth_list_orders",
    "주문 목록을 상태와 배송 방식으로 조회합니다. 구매자 닉네임과 식별 코드는 포함될 수 있습니다.",
    {
      state: z.enum(["all", "unpaid", "paid", "completed", "cancelled"]).optional(),
      shipment: z.enum(["all", "direct", "via_warehouse", "factory_item"]).optional(),
      page: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    (input) => service.listOrders(input),
  );
  register(
    server,
    "booth_get_order",
    "주문 상세를 조회합니다. 닉네임·주문번호·식별 코드는 표시하고 실명·주소·전화·이메일은 마스킹합니다.",
    { orderId: z.string().regex(/^\d+$/u) },
    ({ orderId }) => service.getOrder(orderId),
  );
  register(
    server,
    "booth_get_sales",
    "월별, 일별 또는 상품별 매출을 조회합니다. CSV 발행과 지급 신청은 하지 않습니다.",
    {
      granularity: z.enum(["monthly", "daily", "item"]).optional(),
      page: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    (input) => service.getSales(input),
  );
  register(
    server,
    "booth_list_conversations",
    "판매자 메시지 대화 목록과 상대 닉네임을 조회합니다.",
    {
      page: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    (input) => service.listConversations(input),
  );
  register(
    server,
    "booth_get_conversation",
    "대화 상세를 조회합니다. includeContent가 true이면 이메일·전화·우편번호 패턴을 마스킹한 메시지 본문을 포함합니다.",
    {
      conversationId: z.string().min(4).max(128).regex(/^[\w-]+$/u),
      includeContent: z.boolean().optional(),
    },
    ({ conversationId, includeContent }) => service.getConversation(conversationId, includeContent),
  );
  register(server, "booth_get_shop_settings", "공개 샵 정보와 비금융 운영 설정을 조회합니다.", {}, () => service.getShopSettings());

  return { server, service };
}

export async function startStdioServer(): Promise<void> {
  const { server, service } = createServer();
  const transport = new StdioServerTransport();
  const shutdown = async (): Promise<void> => {
    await service.close();
    await server.close();
  };
  process.once("SIGINT", () => void shutdown().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void shutdown().finally(() => process.exit(0)));
  await server.connect(transport);
}

function register<T extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: T,
  handler: (input: z.infer<z.ZodObject<T>>) => Promise<unknown>,
  annotations: typeof READ_ONLY_ANNOTATIONS | typeof LOGIN_ANNOTATIONS = READ_ONLY_ANNOTATIONS,
): void {
  const inputObject = z.object(inputSchema);
  const outputObject = z.object(resultOutputShape);
  server.registerTool<typeof outputObject, typeof inputObject>(
    name,
    {
      description,
      inputSchema: inputObject,
      outputSchema: outputObject,
      annotations,
    },
    async (input): Promise<CallToolResult> => {
      try {
        const result = await handler(input as z.infer<z.ZodObject<T>>);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      } catch (error) {
        const boothError = asBoothError(error);
        const payload = {
          error: {
            code: boothError.code,
            message: boothError.message,
            ...(boothError.sourceUrl ? { sourceUrl: boothError.sourceUrl } : {}),
          },
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
          isError: true,
        };
      }
    },
  );
}
