export const MARKET_DATA_SUMMARY_TOOL_NAME = 'market_data_summary'

export const DESCRIPTION = `Summarize an A-share CSV OHLCV market data feed.`

export const PROMPT = `Use this tool to inspect a CSV OHLCV file before running a backtest or generating trading signals.

The input CSV must have columns: symbol,date,open,high,low,close,volume

Returns:
- Symbols included in the feed
- Date range
- Number of rows per symbol
- Latest close price per symbol
- High/low range per symbol`
