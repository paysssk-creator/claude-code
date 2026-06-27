import type {
  Broker,
  EquitySnapshot,
  MarketData,
  Order,
  Portfolio,
  Position,
} from '../types.js'
import type { FeeModel } from '../fees/feeModel.js'
import { NoFees } from '../fees/feeModel.js'

export interface PaperBrokerOptions {
  initialCash: number
  marketData: Map<string, MarketData>
  /** Whether to enforce A-share T+1 settlement. Default true. */
  enforceT1?: boolean
  /** Fee model to apply to filled orders. Default: no fees. */
  feeModel?: FeeModel
}

const A_SHARE_LIMIT_PCT = 0.1
const A_SHARE_LOT_SIZE = 100

function generateOrderId(): string {
  return `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class PaperBroker implements Broker {
  private cash: number
  private positions = new Map<string, Position>()
  private orders = new Map<string, Order>()
  private marketData: Map<string, MarketData>
  private readonly buyDates = new Map<string, Date>()
  private readonly enforceT1: boolean
  private readonly feeModel: FeeModel
  private totalFees = 0
  private totalTurnover = 0
  private readonly equityHistory: EquitySnapshot[] = []
  private readonly previousClose = new Map<string, number>()

  constructor(options: PaperBrokerOptions) {
    this.cash = options.initialCash
    this.marketData = options.marketData
    this.enforceT1 = options.enforceT1 ?? true
    this.feeModel = options.feeModel ?? new NoFees()
  }

  getCash(): number {
    return this.cash
  }

  getPortfolio(): Portfolio {
    const positions = Array.from(this.positions.values())
    const marketValue = positions.reduce((sum, pos) => {
      const data = this.marketData.get(pos.symbol)
      const price = data?.close ?? pos.averageCost
      return sum + pos.quantity * price
    }, 0)
    return {
      cash: this.cash,
      positions,
      totalValue: this.cash + marketValue,
    }
  }

  getMarketData(symbol: string): MarketData | undefined {
    return this.marketData.get(symbol)
  }

  setMarketData(symbol: string, data: MarketData): void {
    const existing = this.marketData.get(symbol)
    if (existing) {
      this.previousClose.set(symbol, existing.close)
    }
    this.marketData.set(symbol, data)
  }

  placeOrder(orderInput: Omit<Order, 'id' | 'timestamp' | 'status'>): Order {
    const data = this.marketData.get(orderInput.symbol)
    const now = data?.timestamp ?? new Date()

    const order: Order = {
      ...orderInput,
      id: generateOrderId(),
      timestamp: now,
      status: 'pending',
    }

    if (!data) {
      order.status = 'rejected'
      order.rejectReason = 'No market data for symbol'
      this.orders.set(order.id, order)
      return order
    }

    if (order.quantity <= 0 || order.quantity % A_SHARE_LOT_SIZE !== 0) {
      order.status = 'rejected'
      order.rejectReason = `Quantity must be a multiple of ${A_SHARE_LOT_SIZE}`
      this.orders.set(order.id, order)
      return order
    }

    const executionPrice =
      order.type === 'market' ? data.close : (order.price ?? data.close)

    const prevClose = this.previousClose.get(order.symbol)
    if (prevClose !== undefined) {
      const upperLimit = prevClose * (1 + A_SHARE_LIMIT_PCT)
      const lowerLimit = prevClose * (1 - A_SHARE_LIMIT_PCT)

      if (order.type === 'limit' && order.price !== undefined) {
        if (order.price < lowerLimit) {
          order.status = 'rejected'
          order.rejectReason = 'Limit price below lower price limit'
          this.orders.set(order.id, order)
          return order
        }
        if (order.price > upperLimit) {
          order.status = 'rejected'
          order.rejectReason = 'Limit price above upper price limit'
          this.orders.set(order.id, order)
          return order
        }
      }

      if (executionPrice < lowerLimit || executionPrice > upperLimit) {
        order.status = 'rejected'
        order.rejectReason = 'Execution price outside A-share daily limit'
        this.orders.set(order.id, order)
        return order
      }
    }

    if (order.side === 'buy') {
      const cost = executionPrice * order.quantity
      const fee = this.feeModel.calculateBuyFee(
        cost,
        executionPrice,
        order.quantity,
      )
      if (cost + fee > this.cash) {
        order.status = 'rejected'
        order.rejectReason = 'Insufficient cash'
        this.orders.set(order.id, order)
        return order
      }
      this.cash -= cost + fee
      this.totalFees += fee
      this.totalTurnover += cost
      order.fee = fee
      const existing = this.positions.get(order.symbol)
      if (existing) {
        const totalCost = existing.averageCost * existing.quantity + cost
        const totalQty = existing.quantity + order.quantity
        existing.averageCost = totalCost / totalQty
        existing.quantity = totalQty
      } else {
        this.positions.set(order.symbol, {
          symbol: order.symbol,
          quantity: order.quantity,
          averageCost: executionPrice,
        })
      }
      this.buyDates.set(order.symbol, now)
    } else {
      const existing = this.positions.get(order.symbol)
      if (!existing || existing.quantity < order.quantity) {
        order.status = 'rejected'
        order.rejectReason = 'Insufficient shares'
        this.orders.set(order.id, order)
        return order
      }

      const buyDate = this.buyDates.get(order.symbol)
      if (this.enforceT1 && buyDate && this.isSameTradingDay(buyDate, now)) {
        order.status = 'rejected'
        order.rejectReason = 'A-share T+1: cannot sell shares bought today'
        this.orders.set(order.id, order)
        return order
      }

      const proceeds = executionPrice * order.quantity
      const fee = this.feeModel.calculateSellFee(
        proceeds,
        executionPrice,
        order.quantity,
      )
      this.cash += proceeds - fee
      this.totalFees += fee
      this.totalTurnover += proceeds
      order.fee = fee
      existing.quantity -= order.quantity
      if (existing.quantity === 0) {
        this.positions.delete(order.symbol)
        this.buyDates.delete(order.symbol)
      }
    }

    order.status = 'filled'
    this.orders.set(order.id, order)
    return order
  }

  getOrder(id: string): Order | undefined {
    return this.orders.get(id)
  }

  getOrders(): Order[] {
    return Array.from(this.orders.values())
  }

  getStats(): { totalFees: number; totalTurnover: number } {
    return {
      totalFees: this.totalFees,
      totalTurnover: this.totalTurnover,
    }
  }

  recordEquity(timestamp?: Date): void {
    const portfolio = this.getPortfolio()
    this.equityHistory.push({
      timestamp: timestamp ?? new Date(),
      cash: portfolio.cash,
      positions: portfolio.positions.map(p => ({ ...p })),
      totalValue: portfolio.totalValue,
    })
  }

  getEquityCurve(): EquitySnapshot[] {
    return this.equityHistory
  }

  private isSameTradingDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }
}
