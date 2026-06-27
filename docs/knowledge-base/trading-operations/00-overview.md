# 电脑操盘知识库总览

本知识库用于指导 AI 使用本项目提供的 A 股模拟交易能力，在本地电脑上自主执行回测、策略调试和模拟操盘。

## 核心能力

- **PaperBroker**：A 股仿真券商
  - 100 股一手
  - T+1 交割（可关闭）
  - ±10% 涨跌停价格限制
  - 佣金、印花税、过户费（AShareFeeModel）
  - 资金、持仓、订单、权益曲线记录

- **MomentumStrategy**：动量策略
  - 跌幅买入（dipThreshold）
  - 涨幅止盈（profitThreshold）
  - 止损卖出（stopLossThreshold）
  - 固定手数（lotSize）

- **BasicRiskManager**：风险控制
  - 单笔下注比例上限（maxCashDeployPct）
  - 单个仓位市值上限（maxPositionValuePct）
  - 每日每 symbol 订单数上限（maxOrdersPerDay）
  - 回撤熔断（maxDrawdownPct）

- **CSV 数据 feed**
  - 格式：`symbol,date,open,high,low,close,volume`
  - 自动去重、按日期排序
  - 支持 `#` 注释和空行

- **runBacktest**：回测引擎
  - 输出：权益曲线、信号列表、成交记录、总收益、最大回撤、夏普比率、胜率、交易笔数、买入持有基准收益

## 可执行入口

### 脚本方式
```bash
bun run paper-trade:demo
bun run paper-trade:csv
```

### CLI 方式
```bash
claude paper-trade --csv scripts/data/sample-ohlcv.csv
claude paper-trade --csv data/my-ohlcv.csv --cash 200000 --dip 0.05 --profit 0.08 --stop-loss 0.04 --max-drawdown 0.1
```

## 标准操盘流程

1. 准备 CSV 历史数据
2. 配置策略参数和风险参数
3. 运行回测
4. 分析统计指标和权益曲线
5. 根据结果调整参数或策略
6. （未来）对接真实券商 API 前，先用模拟盘验证

## 记忆点

- A 股规则：100 股整数倍、T+1、±10% 涨跌停
- 模拟盘不会产生真实订单和资金变动
- 回测结果中的 `benchmarkReturnPct` 是等权买入持有基准，用于评估策略是否跑赢大盘
- 夏普比率、胜率、最大回撤是评估策略稳定性的核心指标
