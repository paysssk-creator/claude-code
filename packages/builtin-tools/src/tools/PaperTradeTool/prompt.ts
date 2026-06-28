export const PAPER_TRADE_TOOL_NAME = 'paper_trade'

export const DESCRIPTION = `Run an A-share paper-trading backtest on a CSV OHLCV file and return structured results.`

export const PROMPT = `Use this tool to run a simulated A-share trading backtest.

The input CSV must have columns: symbol,date,open,high,low,close,volume

Rules enforced by the backtest engine:
- A-share lot size: 100 shares per order
- Daily price limit: ±10% from previous close
- T+1 settlement: shares bought today cannot be sold today
- Fees: A-share commission/stamp duty model

Returns a structured summary including equity curve, signals, trades, total return, max drawdown, Sharpe ratio, win rate, and benchmark return.`
