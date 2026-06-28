export type OrderSide = 'buy' | 'sell'

export type OrderType = 'market' | 'limit'

export type OrderStatus = 'pending' | 'filled' | 'rejected'

export interface Order {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  price?: number
  timestamp: Date
  status: OrderStatus
  fee?: number
  rejectReason?: string
}

export interface MarketData {
  symbol: string
  timestamp: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Position {
  symbol: string
  quantity: number
  averageCost: number
}

export interface Portfolio {
  cash: number
  positions: Position[]
  totalValue: number
}

export interface Broker {
  getCash(): number
  getPortfolio(): Portfolio
  getMarketData(symbol: string): MarketData | undefined
  placeOrder(order: Omit<Order, 'id' | 'timestamp' | 'status'>): Order
  getOrder(id: string): Order | undefined
  getOrders(): Order[]
}

export interface StrategySignal {
  symbol: string
  side: OrderSide
  quantity: number
  reason: string
}

export interface Strategy {
  evaluate(data: MarketData, portfolio: Portfolio): StrategySignal | null
  evaluateAsync?(
    data: MarketData,
    portfolio: Portfolio,
  ): Promise<StrategySignal | null>
}

export interface EquitySnapshot {
  timestamp: Date
  cash: number
  positions: Position[]
  totalValue: number
}
