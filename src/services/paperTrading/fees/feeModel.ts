export interface FeeModel {
  calculateBuyFee(amount: number, price: number, quantity: number): number
  calculateSellFee(amount: number, price: number, quantity: number): number
}

export class NoFees implements FeeModel {
  calculateBuyFee(_amount: number, _price: number, _quantity: number): number {
    return 0
  }

  calculateSellFee(_amount: number, _price: number, _quantity: number): number {
    return 0
  }
}

export interface AShareFeeModelOptions {
  /** Commission rate, default 0.00025 (0.025%). */
  commissionRate?: number
  /** Minimum commission per order in CNY, default 5. */
  minCommission?: number
  /** Stamp duty on sell only, default 0.001 (0.1%). */
  stampDutyRate?: number
  /** Transfer fee rate (both sides), default 0.00002 (0.002%). */
  transferFeeRate?: number
}

/**
 * Simplified A-share fee model.
 *
 * - Commission charged on both buy and sell, subject to a minimum.
 * - Stamp duty charged on sell only.
 * - Transfer fee charged on both sides.
 */
export class AShareFeeModel implements FeeModel {
  private readonly commissionRate: number
  private readonly minCommission: number
  private readonly stampDutyRate: number
  private readonly transferFeeRate: number

  constructor(options: AShareFeeModelOptions = {}) {
    this.commissionRate = options.commissionRate ?? 0.00025
    this.minCommission = options.minCommission ?? 5
    this.stampDutyRate = options.stampDutyRate ?? 0.001
    this.transferFeeRate = options.transferFeeRate ?? 0.00002
  }

  calculateBuyFee(amount: number, price: number, quantity: number): number {
    return (
      Math.max(this.round(amount * this.commissionRate), this.minCommission) +
      this.round(price * quantity * this.transferFeeRate)
    )
  }

  calculateSellFee(amount: number, price: number, quantity: number): number {
    return (
      Math.max(this.round(amount * this.commissionRate), this.minCommission) +
      this.round(amount * this.stampDutyRate) +
      this.round(price * quantity * this.transferFeeRate)
    )
  }

  private round(value: number): number {
    return Number(value.toFixed(2))
  }
}
