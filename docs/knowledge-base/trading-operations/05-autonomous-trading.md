# Autonomous A-Share Trading

This playbook describes how to run the autonomous A-share paper-trading agent built on top of the backtest engine.

## What it is

The `a-share-trader` agent is a built-in Claude Code subagent specialized for A-share quantitative analysis. It can:

- Inspect CSV OHLCV feeds.
- Run paper-trading backtests.
- Generate AI-driven trading signals.
- Log decisions and lessons learned.
- Schedule recurring analysis via cron.

All operations remain in simulation / paper mode. No real-money trades are executed.

## Slash commands

| Command | Purpose |
|---------|---------|
| `/a-share-backtest <csv>` | Run and analyze a backtest on the given CSV. |
| `/a-share-trade <csv>` | Produce AI-driven signals for the latest day and write a decision log. |
| `/a-share-loop [interval] <csv>` | Schedule recurring `/a-share-trade` analysis. Defaults to `1d`. |
| `/a-share-desktop-trade <app> [symbols...]` | Operate a Chinese retail trading desktop app in paper mode. |
| `/a-share-desktop-loop [interval] <app> [symbols...]` | Schedule recurring `/a-share-desktop-trade` sessions. Defaults to `1d`. |

## A-share rules enforced

- **Lot size**: 100 shares per order.
- **Daily limit**: ±10% from previous close.
- **T+1 settlement**: shares bought today cannot be sold today.
- **Fees**: A-share commission/stamp duty model.

## Decision logs

Decision logs are written to:

```text
docs/knowledge-base/trading-operations/decisions/YYYY-MM-DD-<symbols>.md
```

Each log contains frontmatter (`date`, `symbols`, `finalValue`, `totalReturnPct`) plus narrative rationale and lessons learned. The agent reads recent decision logs before making new decisions.

## Desktop paper trading (Phase 7)

The `a-share-desktop-trader` agent can operate real Chinese retail trading desktop applications (同花顺, 东方财富) while staying strictly in the app’s paper/simulation mode.

### Command

```text
/a-share-desktop-trade <app> [symbols...]
```

Supported app identifiers:

| Identifier | Application |
|------------|-------------|
| `ths`      | 同花顺      |
| `eastmoney`| 东方财富    |

Example:

```text
/a-share-desktop-trade ths 000001 600519
```

### Safety rules

1. **Paper only**: The agent must only use the app’s 模拟炒股 / 模拟交易 mode. If it detects real-money UI text (实盘交易, 真实账户, 资金账号, 银证转账) it must stop and ask the user.
2. **Request access**: Always call `mcp__computer-use__request_access` before controlling the app.
3. **Bind window**: Use `mcp__computer-use__bind_window` and `unbind` when done.
4. **Screenshot before/after**: Verify every screen state with `mcp__computer-use__screenshot`.
5. **No real orders**: The local broker is a shadow ledger; actual order entry happens only inside the app’s paper-trading UI.

### Headless / cron usage

When the desktop agent is launched non-interactively (e.g. `claude --print --agent a-share-desktop-trader ...` or by an external scheduler), the Computer Use MCP server is normally skipped. Add the following CLI flags:

```text
--load-computer-use-mcp
```

Because permission prompts cannot be shown headlessly, also add **one** of the following only if the user has explicitly pre-approved unattended execution:

```text
--enable-auto-mode                # recommended when the auto-mode classifier is available
--permission-mode bypassPermissions # only with explicit autonomous authorization
```

`/a-share-desktop-loop` fires inside the running Claude Code session, so it does not need these flags as long as the session stays open.

### Architecture

- `src/services/paperTrading/desktop/appProfiles.ts` — app navigation profiles.
- `src/services/paperTrading/desktop/uiNavigator.ts` — computer-use MCP wrapper.
- `src/services/paperTrading/brokers/desktopPaperBroker.ts` — shadow Broker implementation.
- `src/services/paperTrading/desktop/runDesktopTradingSession.ts` — session orchestration.

### Workflow

1. Request access for the target app.
2. Open and bind the app window.
3. Navigate to paper trading and confirm by screenshot.
4. Read portfolio (cash + positions) and per-symbol market data.
5. Decide, risk-check, and place paper orders.
6. Reconcile the shadow ledger and write a decision log.
7. Unbind the window.

## Extending the agent

- Add new tools to the `a-share-trader` agent allowlist in `packages/builtin-tools/src/tools/AgentTool/built-in/aShareTrader.ts`.
- Add new desktop apps in `src/services/paperTrading/desktop/appProfiles.ts`.
- Customize the `AgentDecideSignal` callback in `src/services/paperTrading/agentRunner.ts` to plug in LLM-driven decisions.
- Update this playbook when new capabilities or rules are added.
