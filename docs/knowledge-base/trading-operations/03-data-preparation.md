# 操盘 playbook：准备 CSV 数据

## 目标
为回测准备符合格式要求的 A 股历史行情 CSV。

## 格式要求

```csv
symbol,date,open,high,low,close,volume
000001,2026-06-28,10.00,10.20,9.90,10.00,1000000
000001,2026-06-29,10.00,10.10,9.40,9.50,1200000
```

## 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| symbol | string | 股票代码，如 000001 |
| date | YYYY-MM-DD | 交易日期 |
| open | number | 开盘价 |
| high | number | 最高价 |
| low | number | 最低价 |
| close | number | 收盘价 |
| volume | number | 成交量 |

## 支持特性

- `#` 开头的行为注释
- 空行自动忽略
- 多个 symbol 可以交错或分组排列
- 日期首次出现的顺序决定回测日期序列

## 数据源建议

- Tushare Pro
- AKShare
- Yahoo Finance（需映射 A 股代码）
- 券商量化接口

## AKShare 示例

```python
import akshare as ak

df = ak.stock_zh_a_hist(symbol="000001", period="daily", start_date="20240101", end_date="20241231")
df = df.rename(columns={
    "股票代码": "symbol",
    "日期": "date",
    "开盘": "open",
    "最高": "high",
    "最低": "low",
    "收盘": "close",
    "成交量": "volume",
})
df[["symbol", "date", "open", "high", "low", "close", "volume"]].to_csv("000001.csv", index=False)
```

## 数据校验

运行前检查：
- 日期格式统一为 `YYYY-MM-DD`
- 价格满足 `low <= open, close <= high`
- 单日涨跌幅不超过 ±10%（ST 股 ±5%）
- volume 为非负整数

## 多股合并

将多个单股 CSV 按行合并即可：
```bash
cat 000001.csv 000002.csv > combined.csv
```

注意保留统一的表头，或确保只有第一个文件有表头。
