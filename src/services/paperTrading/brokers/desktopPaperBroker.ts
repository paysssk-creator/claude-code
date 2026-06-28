/**
 * Desktop paper broker.
 *
 * Implements the Broker interface while delegating observation and order
 * execution to a real Chinese retail trading desktop application running in
 * paper/simulation mode. A local shadow ledger (via PaperBroker) caches
 * portfolio and market data so that synchronous Broker methods can return
 * instantly; asynchronous reconciliation with the app is performed by the
 * session runner before each decision.
 */

import type { Broker, MarketData, Order, Position } from '../types.js'
import type { FeeModel } from '../fees/feeModel.js'
import { NoFees } from '../fees/feeModel.js'
import { PaperBroker } from './paperBroker.js'
import type { DesktopUINavigator } from '../desktop/uiNavigator.js'

export interface DesktopBrokerOptions {
  navigator: DesktopUINavigator
  initialCash: number
  initialPositions?: Position[]
  enforceT1?: boolean
  feeModel?: FeeModel
}

const A_SHARE_LOT_SIZE = 100

function generateOrderId(): string {
  return `desktop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class DesktopBroker extends PaperBroker implements Broker {
  private readonly navigator: DesktopUINavigator
  private readonly pendingMarketData = new Map<string, MarketData>()
  private readonly pendingOrderPromises: Promise<void>[] = []

  constructor(options: DesktopBrokerOptions) {
    const marketData = new Map<string, MarketData>()
    super({
      initialCash: options.initialCash,
      marketData,
      enforceT1: options.enforceT1 ?? true,
      feeModel: options.feeModel ?? new NoFees(),
    })
    this.navigator = options.navigator
    if (options.initialPositions) {
      for (const pos of options.initialPositions) {
        this.positions.set(pos.symbol, { ...pos })
      }
    }
  }

  /**
   * Read the app's paper-trading portfolio and replace the shadow ledger.
   * Call this before making trading decisions so the shadow state is current.
   */
  async reconcilePortfolio(): Promise<void> {
    const snapshot = await this.navigator.readPortfolio()
    this.syncPortfolio(snapshot.cash, snapshot.positions)
  }

  /**
   * Read the latest market data for a symbol from the app and cache it.
   */
  async refreshMarketData(symbol: string): Promise<MarketData> {
    const data = await this.navigator.readMarketData(symbol)
    this.setMarketData(symbol, data)
    this.pendingMarketData.set(symbol, data)
    return data
  }

  override getMarketData(symbol: string): MarketData | undefined {
    return this.pendingMarketData.get(symbol) ?? super.getMarketData(symbol)
  }

  override placeOrder(
    orderInput: Omit<Order, 'id' | 'timestamp' | 'status'>,
  ): Order {
    const data = this.getMarketData(orderInput.symbol)
    if (!data) {
      const order: Order = {
        ...orderInput,
        id: generateOrderId(),
        timestamp: new Date(),
        status: 'rejected',
        rejectReason: 'No market data for symbol',
      }
      this.orders.set(order.id, order)
      return order
    }

    if (
      orderInput.quantity <= 0 ||
      orderInput.quantity % A_SHARE_LOT_SIZE !== 0
    ) {
      const order: Order = {
        ...orderInput,
        id: generateOrderId(),
        timestamp: data.timestamp,
        status: 'rejected',
        rejectReason: `Quantity must be a multiple of ${A_SHARE_LOT_SIZE}`,
      }
      this.orders.set(order.id, order)
      return order
    }

    const side = orderInput.side
    const price =
      orderInput.type === 'market'
        ? data.close
        : (orderInput.price ?? data.close)

    // Validate against the shadow ledger before asking the app to execute.
    if (side === 'buy') {
      const cost = price * orderInput.quantity
      const fee = this.feeModel.calculateBuyFee(
        cost,
        price,
        orderInput.quantity,
      )
      if (cost + fee > this.cash) {
        const order: Order = {
          ...orderInput,
          id: generateOrderId(),
          timestamp: data.timestamp,
          status: 'rejected',
          rejectReason: 'Insufficient cash',
        }
        this.orders.set(order.id, order)
        return order
      }
    } else {
      const existing = this.positions.get(orderInput.symbol)
      if (!existing || existing.quantity < orderInput.quantity) {
        const order: Order = {
          ...orderInput,
          id: generateOrderId(),
          timestamp: data.timestamp,
          status: 'rejected',
          rejectReason: 'Insufficient shares',
        }
        this.orders.set(order.id, order)
        return order
      }

      const buyDate = this.buyDates.get(orderInput.symbol)
      if (
        this.enforceT1 &&
        buyDate &&
        this.isSameTradingDay(buyDate, data.timestamp)
      ) {
        const order: Order = {
          ...orderInput,
          id: generateOrderId(),
          timestamp: data.timestamp,
          status: 'rejected',
          rejectReason: 'A-share T+1: cannot sell shares bought today',
        }
        this.orders.set(order.id, order)
        return order
      }
    }

    // Execute through the desktop app's paper-trading UI.
    const pendingOrder: Order = {
      ...orderInput,
      id: generateOrderId(),
      timestamp: data.timestamp,
      status: 'pending',
    }

    const promise = this.navigator
      .placePaperOrder({
        symbol: orderInput.symbol,
        side,
        price,
        quantity: orderInput.quantity,
      })
      .then(() => {
        // After the app confirms, update the shadow ledger to match.
        const filled = super.placeOrder({
          ...orderInput,
          price,
          type: orderInput.type,
        })
        // Preserve the original pending order ID so callers see one coherent
        // order record instead of a pending + filled pair.
        this.orders.delete(filled.id)
        pendingOrder.status = 'filled'
        pendingOrder.fee = filled.fee
        this.orders.set(pendingOrder.id, pendingOrder)
      })
    this.pendingOrderPromises.push(promise)

    return pendingOrder
  }

  /**
   * Wait for all in-flight desktop order placements to complete and update
   * the shadow ledger.
   */
  async flush(): Promise<void> {
    await Promise.all(this.pendingOrderPromises)
    this.pendingOrderPromises.length = 0
  }
}
