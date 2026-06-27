# 操盘 playbook：扩展自定义策略

## 目标
在现有 paper-trading 框架上实现新的交易策略。

## Strategy 接口

```typescript
import type { MarketData, Portfolio, Strategy, StrategySignal } from './types.js'

export class MyStrategy implements Strategy {
  evaluate(data: MarketData, portfolio: Portfolio): StrategySignal | null {
    // data: { symbol, timestamp, open, high, low, close, volume }
    // portfolio: { cash, positions, totalValue }
    // 返回 signal 或 null
  }
}
```

## StrategySignal 结构

```typescript
{
  symbol: string,
  side: 'buy' | 'sell',
  quantity: number,
  reason: string
}
```

## 示例：均线交叉策略

```typescript
export class MovingAverageCrossStrategy implements Strategy {
  private prices = new Map<string, number[]>()

  constructor(private shortWindow = 5, private longWindow = 20, private lotSize = 100) {}

  evaluate(data: MarketData, portfolio: Portfolio): StrategySignal | null {
    const history = this.prices.get(data.symbol) ?? []
    history.push(data.close)
    this.prices.set(data.symbol, history)

    if (history.length < this.longWindow) return null

    const short = this.avg(history.slice(-this.shortWindow))
    const long = this.avg(history.slice(-this.longWindow))
    const position = portfolio.positions.find(p => p.symbol === data.symbol)

    if (short > long && !position) {
      return { symbol: data.symbol, side: 'buy', quantity: this.lotSize, reason: 'Golden cross' }
    }
    if (short < long && position && position.quantity > 0) {
      return { symbol: data.symbol, side: 'sell', quantity: position.quantity, reason: 'Death cross' }
    }
    return null
  }

  private avg(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length
  }
}
```

## 注册新策略

1. 在 `src/services/paperTrading/strategy/` 下创建新文件
2. 实现 `Strategy` 接口
3. 在 `src/services/paperTrading/index.ts` 中导出
4. 在 `src/cli/handlers/paperTrade.ts` 或自定义脚本中使用

## 接入回测

```typescript
const result = runBacktest({
  broker,
  strategy: new MyStrategy(),
  symbols: feed.symbols,
  dates: feed.dates,
  riskManager,
  updateMarketData: (date, symbol) => {
    const data = feed.get(date, symbol)
    if (!data) throw new Error('missing data')
    broker.setMarketData(symbol, data)
    return data
  },
})
```

## 策略设计原则

- 只使用 `data` 和 `portfolio` 中的信息
- 保持无状态或内部状态简单（便于复现）
- 返回的 `quantity` 必须是 100 的整数倍
- 通过 `reason` 记录决策依据，便于调试
