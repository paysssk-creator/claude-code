# Desktop Paper Trading

This guide covers running A-share paper-trading sessions through real Chinese
retail trading desktop applications (e.g. 同花顺 / 东方财富) using the built-in
computer-use MCP.

All operations stay strictly inside the application's built-in simulation /
mock-trading mode (模拟炒股 / 模拟交易). Real-money account flows are refused.

## Commands

```bash
# Interactive run
/a-share-desktop-trade ths 000001 600519

# Headless / scheduled run (requires prior approval)
bun run dev --load-computer-use-mcp --permission-mode bypassPermissions \
  --agent a-share-desktop-trader --print "/a-share-desktop-trade ths 000001 600519"
```

## Supported applications

| Profile id | Application | Executable | Notes |
|------------|-------------|------------|-------|
| `ths`      | 同花顺       | `hexin.exe` | Main terminal window must be logged in to a simulated account. |
| `eastmoney`| 东方财富     | `Eastmoney.exe` | Choice terminal or main trading client in simulation mode. |

## Safety rules

1. **Paper / simulation only.** The agent must only navigate to 模拟炒股 /
   模拟交易. If it sees 实盘交易, 真实账户, 资金账号, or 银证转账, it stops and
   asks for confirmation.
2. **Request access first.** Every session calls
   `mcp__computer-use__request_access` before taking screenshots or sending input.
3. **Bind the main window.** When 同花顺 is already running, bind to the main
   terminal window (e.g. `同花顺(9.60.20) - 首页`). Avoid auxiliary windows such
   as `问财AI助手`, login dialogs, or update popups.
4. **Screenshot before and after.** The agent takes screenshots to verify each
   navigation step.
5. **Unbind at the end.** The window binding is released when the session ends.

## Workflow

1. Read `docs/knowledge-base/computer-use/00-overview.md` and
   `01-screenshot-observe.md`.
2. Read this guide and `05-autonomous-trading.md`.
3. Request access for the target app.
4. List windows and bind the main terminal window.
5. Navigate to the paper-trading panel and confirm by screenshot.
6. Read the paper portfolio (cash + positions).
7. For each symbol, read market data, generate a signal, risk-check, and place a
   paper limit order.
8. Screenshot order confirmations.
9. Read the final portfolio.
10. Write a decision log to
    `docs/knowledge-base/trading-operations/decisions/YYYY-MM-DD-<symbols>.md`.
11. Unbind the window and report results.

## Troubleshooting

### `429 Your account ... is suspended due to insufficient balance`

The desktop trading agent relies on the LLM to interpret screenshots and decide
actions. If the API provider returns a balance error, recharge the account or
switch to another configured provider (Anthropic, Gemini, Grok, or a local
OpenAI-compatible endpoint).

### Bound to the wrong window (e.g. `问财AI助手`)

Use `mcp__computer-use__bind_window action=unbind`, list windows again, and bind
explicitly to the main terminal title. The skill and agent prompts instruct the
model to prefer the main window and avoid auxiliary popups.

### `open_application` fails with `LAUNCH_FAILED`

The app is already running. List windows and bind the existing one instead of
launching a second instance.

### Computer-use MCP tools are not loaded

In headless mode, pass `--load-computer-use-mcp` and ensure the platform is
supported. The CLI sets `CLAUDE_CODE_LOAD_COMPUTER_USE_MCP=1` to bypass any
cached GrowthBook disable flag.

## Extending app profiles

Application profiles live in
`src/services/paperTrading/desktop/appProfiles.ts`. To add a new broker:

1. Implement `AppProfile` with selectors, market-data regions, and order-form
   steps in the target app's language.
2. Add the profile to the `PROFILES` map.
3. Add unit tests in
   `src/services/paperTrading/desktop/__tests__/desktopPaperBroker.test.ts` and
   `runDesktopTradingSession.test.ts`.
4. Run `bun run precheck` before committing.
