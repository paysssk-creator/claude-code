# 操盘 playbook：执行一次 A 股回测

## 目标
使用本地 CSV 历史数据运行一次完整的 A 股模拟回测。

## 前置条件

1. 已安装依赖：`bun install`
2. 已构建项目：`bun run build`
3. 有 CSV 文件，格式为：
   ```
   symbol,date,open,high,low,close,volume
   000001,2026-06-28,10.00,10.20,9.90,10.00,1000000
   ```

## 快速开始

使用默认示例数据：
```bash
claude paper-trade
```

或指定参数：
```bash
claude paper-trade \
  --csv scripts/data/sample-ohlcv.csv \
  --cash 100000 \
  --dip 0.03 \
  --profit 0.05 \
  --stop-loss 0.05 \
  --max-drawdown 0.1
```

## 参数说明

| 参数 | 含义 | 默认值 |
|------|------|--------|
| `--csv` | CSV 文件路径 | `scripts/data/sample-ohlcv.csv` |
| `--cash` | 初始资金 | 100000 |
| `--dip` | 跌幅买入阈值 | 0.03 |
| `--profit` | 止盈阈值 | 0.05 |
| `--stop-loss` | 止损阈值 | 0.05 |
| `--max-drawdown` | 回撤熔断阈值 | 无限制 |

## 解读回测报告

### 每日持仓
- Cash：剩余现金
- Positions：当前持仓
- Total value：总资产

### 信号
- BUY/SELL 及其原因

### 交易统计
- Total turnover：总成交额
- Total fees：总手续费
- Total return：策略总收益率
- Benchmark return：等权买入持有基准收益率
- Max drawdown：最大回撤
- Sharpe ratio：夏普比率
- Win rate：胜率
- Total trades：交易笔数

### 成交记录
- 每笔卖出的实现盈亏（P&L）

## 失败排查

- `No valid data rows found`：CSV 为空或格式错误
- `Invalid numeric value`：价格/成交量包含非数字
- `Quantity must be a multiple of 100`：A 股一手 100 股
- `A-share T+1`：当日买入不能当日卖出
- `Execution price outside A-share daily limit`：价格超出 ±10% 涨跌停
