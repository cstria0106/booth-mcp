---
name: booth
description: Use for requests to query or analyze the user's BOOTH seller shop, products, orders, sales, customer conversations, messages, or shop settings. Automatically use the bundled read-only BOOTH MCP tools without asking which MCP server is installed. Do not use for general BOOTH platform questions, fees, policies, or other public information unrelated to the user's seller account.
---

# BOOTH seller

Use the bundled `booth_*` tools for the user's BOOTH seller account.

## Workflow

- Call the task-specific tool directly. Do not check authentication before every request.
- If BOOTH tools are not visible, search the available tools for `booth` or `booth_*`, then continue without asking the user which MCP servers are installed.
- If a tool returns `AUTH_REQUIRED`, explain that a browser sign-in will open, call `booth_login`, and retry the original read.
- Do not use web search for private seller data.
- Treat every data tool as read-only. Do not claim to modify BOOTH, send messages, download files, or perform fulfillment actions.
- Preserve the redactions returned by the tools and mention material masking when it affects the answer.

## Tool routing

- Shop overview or recent performance: `booth_get_dashboard`
- Connection or signed-in shop identity: `booth_auth_status`
- Product lists, drafts, and public or private items: `booth_list_items`
- One product or item ID: `booth_get_item`
- Order queues, statuses, and fulfillment methods: `booth_list_orders`
- One order ID: `booth_get_order`
- Revenue, sales trends, and product performance: `booth_get_sales`
- Customer inquiry list: `booth_list_conversations`
- One conversation or its messages: `booth_get_conversation`
- Shop name, URL, publication state, description, or preferences: `booth_get_shop_settings`

For a summary that spans multiple areas, start with the narrowest useful overview and fetch additional detail only when needed.
