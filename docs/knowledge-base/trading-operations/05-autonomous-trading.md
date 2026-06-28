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

## Extending the agent

- Add new tools to the `a-share-trader` agent allowlist in `packages/builtin-tools/src/tools/AgentTool/built-in/aShareTrader.ts`.
- Customize the `AgentDecideSignal` callback in `src/services/paperTrading/agentRunner.ts` to plug in LLM-driven decisions.
- Update this playbook when new capabilities or rules are added.
