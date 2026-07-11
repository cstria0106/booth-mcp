# booth-mcp

BOOTH 판매자 관리 페이지를 MCP 클라이언트에서 조회하기 위한 비공식·읽기 전용 MCP 서버입니다. Codex, Claude Desktop, Cursor처럼 로컬 `stdio` MCP를 지원하는 클라이언트에서 사용할 수 있습니다.

브라우저는 `booth-mcp login`에서만 실행됩니다. 모든 MCP 조회는 저장된 BOOTH 세션으로 HTML 또는 내부 JSON API에 직접 `GET` 요청을 보내며 Chromium 프로세스를 실행하지 않습니다.

> 이 프로젝트는 pixiv 또는 BOOTH의 공식 프로젝트가 아닙니다. BOOTH의 화면 구조가 바뀌면 일부 도구가 `BOOTH_CHANGED` 오류를 반환할 수 있습니다.

## 지원 기능

- 판매자 로그인 상태와 대시보드
- 상품 목록 및 디지털 상품 상세
- 주문 목록 및 주문 상세
- 월별·일별·상품별 매출
- 메시지 목록 및 대화 내용
- 공개 샵 정보와 비금융 운영 설정

BOOTH 계정에 대한 생성, 수정, 공개, 발송 처리, 메시지 전송, 삭제, CSV 발행, 파일 다운로드, 지급 신청은 지원하지 않습니다. MCP 런타임의 HTTP 계층은 `GET` 요청만 구현하며 `POST`, `PUT`, `PATCH`, `DELETE` 호출 경로를 제공하지 않습니다.

## 요구 사항

- Node.js 20 이상
- npm 또는 Bun 1.3 이상
- 최초 로그인 시 화면을 표시할 수 있는 데스크톱 환경
- Google Chrome 또는 Microsoft Edge

별도의 Playwright Chromium은 다운로드하지 않습니다. 로그인할 때 운영체제에 이미 설치된 Chrome을 우선 사용하고, 없으면 Edge를 사용합니다.

## 로그인

MCP에서 `booth_login` 도구를 호출하면 시스템 브라우저가 열리고 로그인 완료까지 최대 10분 기다립니다. 모델은 `AUTH_REQUIRED` 응답을 받은 뒤 사용자에게 로그인을 안내하고 이 도구를 호출할 수 있습니다. MCP 클라이언트의 도구 제한 시간이 짧으면 호출이 먼저 종료될 수 있으므로 장시간 도구 호출을 허용해야 합니다.

터미널에서 먼저 로그인하는 방식도 지원합니다.

```bash
npx -y booth-mcp login
```

열린 브라우저에서 직접 BOOTH 로그인을 마치면 창이 닫힙니다. `booth-mcp`는 비밀번호를 입력받거나 쿠키를 출력하지 않습니다. 로그인 후 `booth.pm` 계열 쿠키와 저장소만 별도의 Playwright `storageState` 파일로 추출합니다.

Chrome과 Edge를 자동으로 찾지 못하거나 다른 Chromium 계열 브라우저를 사용하려면 실행 파일 경로를 지정할 수 있습니다.

```bash
# macOS/Linux
BOOTH_MCP_BROWSER_PATH=/path/to/chrome npx -y booth-mcp login

# Windows PowerShell
$env:BOOTH_MCP_BROWSER_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
npx -y booth-mcp login
```

Windows의 기본 저장 위치는 다음과 같습니다.

```text
%LOCALAPPDATA%\booth-mcp\browser-profile
%LOCALAPPDATA%\booth-mcp\session.json
```

- `browser-profile`은 로그인에만 사용합니다.
- `session.json`은 브라우저 없는 HTTP 조회에 사용하며 BOOTH 세션 쿠키가 포함된 민감한 파일입니다.
- 저장 위치는 각각 `BOOTH_MCP_PROFILE_DIR`, `BOOTH_MCP_SESSION_FILE` 환경변수로 변경할 수 있습니다.
- 로그인 브라우저 실행 파일은 `BOOTH_MCP_BROWSER_PATH`로 직접 지정할 수 있습니다.
- `session.json`을 공유하거나 저장소에 커밋하지 마세요.

로그인 명령에는 인증에 필요한 요청이 허용됩니다. 실제 MCP 서버가 시작된 뒤에는 브라우저를 실행하지 않으며 HTTP `GET`만 사용합니다.

## 데이터 접근 방식

- 상품 목록: `manage.booth.pm/items.json`
- 상품 상세: `manage.booth.pm/items/:itemId`
- 주문 상세: `api.booth.pm/frontend/manage/orders/:orderId.json`
- 대화 상세: `api.booth.pm/frontend/manage/conversations/:conversationId`
- 주문·매출·대화 목록·샵 설정: 서버 렌더링 HTML
- 대시보드: 샵 설정과 월별 매출 조회 결과를 조합

상품·주문·대화 상세 API에 필요한 CSRF 토큰은 해당 관리 HTML의 meta 태그에서 읽어 요청 메모리에서만 사용합니다. 토큰은 로그나 별도 파일에 저장하지 않습니다.

## MCP 클라이언트 설정

### Codex 플러그인 설치 (권장)

Codex에서는 MCP 설정과 `booth` 스킬을 함께 설치할 수 있습니다. 스킬은 판매자 샵, 상품, 주문, 매출, 고객 문의 관련 요청에서 BOOTH 도구를 능동적으로 선택하도록 안내합니다.

```bash
codex plugin marketplace add cstria0106/booth-mcp
codex plugin add booth-mcp@booth-mcp
```

설치하거나 업데이트한 뒤에는 새 작업을 시작하세요. 자동으로 선택되지 않는 요청에서는 `$booth`를 명시해 호출할 수도 있습니다.

플러그인 marketplace를 업데이트하려면 다음 명령을 실행한 뒤 플러그인을 다시 추가하고 새 작업을 시작합니다.

```bash
codex plugin marketplace upgrade booth-mcp
codex plugin add booth-mcp@booth-mcp
```

### Codex 수동 설정

플러그인을 사용하지 않거나 MCP 서버를 직접 관리하려는 경우 Codex 설정에 다음 서버를 추가합니다.

```toml
[mcp_servers.booth]
command = "npx"
args = ["-y", "booth-mcp"]
```

### Claude Desktop

`claude_desktop_config.json`의 `mcpServers`에 추가합니다.

```json
{
  "mcpServers": {
    "booth": {
      "command": "npx",
      "args": ["-y", "booth-mcp"]
    }
  }
}
```

### Cursor

Cursor MCP 설정에 추가합니다.

```json
{
  "mcpServers": {
    "booth": {
      "command": "npx",
      "args": ["-y", "booth-mcp"]
    }
  }
}
```

## 제공 도구

| 도구 | 설명 |
| --- | --- |
| `booth_login` | 시스템 브라우저를 열고 로그인 완료까지 기다린 뒤 로컬 세션 저장 |
| `booth_auth_status` | 로그인 상태와 샵 식별 정보 |
| `booth_get_dashboard` | 샵 상태와 최근 매출 요약 |
| `booth_list_items` | 상태별 상품 목록 |
| `booth_get_item` | 상품 상세와 디지털 파일 메타데이터 |
| `booth_list_orders` | 상태·배송 방식별 주문 목록 |
| `booth_get_order` | 주문 상세 |
| `booth_get_sales` | 월별·일별·상품별 매출 |
| `booth_list_conversations` | 대화 목록과 상대 닉네임 |
| `booth_get_conversation` | 대화 메타데이터 또는 메시지 본문 |
| `booth_get_shop_settings` | 공개 샵 정보와 비금융 설정 |

목록 도구의 기본 조회 수는 20개이고 최대 50개입니다. BOOTH 서버에 부담을 주지 않도록 요청은 한 번에 하나씩 처리하며 페이지 탐색 사이에 최소 1초를 둡니다.

## 개인정보 처리

- 닉네임, 주문번호, 식별 코드, 상품명과 메시지 작성자 닉네임은 표시합니다.
- 주문 상세의 실명, 우편 주소, 전화번호, 이메일은 항상 `[마스킹]`으로 반환합니다.
- `booth_get_conversation`에서 `includeContent=true`를 지정하면 메시지 본문을 반환하되 이메일·전화번호·우편번호 형식은 마스킹합니다.
- 메시지 본문의 자유 형식 개인정보는 모든 표현을 완벽하게 탐지할 수 없습니다. 신뢰할 수 있는 로컬 MCP 클라이언트에서만 사용하세요.
- 정산 계좌와 법적 판매자 정보는 조회하지 않습니다.
- 원본 HTML, 세션 쿠키와 브라우저 프로필 내용은 로그에 기록하지 않습니다.

## 오류 코드

- `AUTH_REQUIRED`: `booth_login` 도구 호출 또는 `npx booth-mcp login`으로 로그인이 필요함
- `NOT_FOUND`: 상품·주문·대화를 찾을 수 없거나 ID가 올바르지 않음
- `BOOTH_CHANGED`: BOOTH 화면 구조를 안전하게 인식할 수 없음
- `RATE_LIMITED`: BOOTH가 요청을 제한함
- `NETWORK_ERROR`: 네트워크 또는 BOOTH 응답 오류

## 개발

```bash
bun install
bun run lint
bun run typecheck
bun run test
bun run build
bun publish --dry-run
```

배포 빌드는 MCP SDK, Zod, Cheerio와 프로젝트 코드를 Node.js용 단일 `dist/cli.js`로 번들합니다. 시스템 브라우저 제어에 필요한 `playwright-core`만 외부 런타임 의존성으로 유지하며 Chromium 실행 파일은 포함하지 않습니다.

실제 계정을 사용하는 읽기 전용 smoke test는 명시적으로만 실행됩니다.

```bash
bun run test:live
```

테스트 fixture는 가상 데이터만 포함하며 실제 주문·메시지·세션을 저장소에 커밋하지 않습니다.

## 이용 정책

BOOTH는 사용자 편의와 창작 활동의 건전한 발전을 위한 상식적인 범위의 정보 분석 목적 수집을 허용하지만, 과도한 부하나 권리 침해 또는 피해 가능성이 있는 행위를 제한합니다. 사용 전 [BOOTH 가이드라인](https://booth.pm/guidelines)과 [스크레이핑 정책 공지](https://booth.pm/announcements/863)를 확인하세요.

## 라이선스

MIT
