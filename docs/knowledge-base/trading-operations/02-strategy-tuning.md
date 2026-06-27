# 操盘 playbook：策略调参

## 目标
通过调整 MomentumStrategy 和 BasicRiskManager 参数，找到风险收益比更好的配置。

## 可调参数

### MomentumStrategy
```typescript
new MomentumStrategy({
  dipThreshold: 0.03,      // 收盘价较前一日跌幅 ≥3% 时买入
  profitThreshold: 0.05,   // 持仓盈利 ≥5% 时止盈卖出
  stopLossThreshold: 0.05, // 持仓亏损 ≥5% 时止损卖出（可选）
  lotSize: 100,            // 每次买入 100 股（A 股一手）
})
```

### BasicRiskManager
```typescript
new BasicRiskManager({
  maxCashDeployPct: 0.3,   // 单笔买入不超过总资产 30%
  maxPositionValuePct: 0.6, // 单个持仓市值不超过总资产 60%
  maxOrdersPerDay: 2,      // 每个 symbol 每天最多 2 笔订单
  maxDrawdownPct: 0.1,     // 回撤超过 10% 后停止开新仓（可选）
})
```

## 调参流程

1. 固定一组默认参数运行基准回测
2. 记录 `totalReturnPct`、`maxDrawdownPct`、`sharpeRatio`、`winRatePct`
3. 每次只改变一个参数，重新运行
4. 对比结果，选择综合指标最优的组合

## 参数影响速查

| 参数 | 调大 | 调小 |
|------|------|------|
| dipThreshold | 买入更少但更安全 | 买入更频繁但可能追高 |
| profitThreshold | 止盈更晚，可能吃到更多涨幅 | 止盈更早，落袋为安 |
| stopLossThreshold | 容忍更大亏损 | 更容易止损，减少单笔大亏 |
| lotSize | 单笔仓位更大 | 单笔仓位更小 |
| maxCashDeployPct | 单笔投入更多 | 单笔投入更少 |
| maxDrawdownPct | 更晚停止交易 | 更早停止交易 |

## 批量对比

可以编写脚本循环多组参数：
```bash
for dip in 0.02 0.03 0.05; do
  for profit in 0.05 0.08 0.1; do
    echo "dip=$dip profit=$profit"
    claude paper-trade --csv data/my.csv --dip $dip --profit $profit
  done
done
```

## 注意事项

- 避免过度拟合历史数据
- 至少用 6 个月以上数据验证
- 关注最大回撤是否在可承受范围
