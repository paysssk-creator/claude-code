import { describe, expect, test } from 'bun:test'
import { AShareFeeModel, NoFees } from '../fees/feeModel.js'

describe('NoFees', () => {
  test('returns zero for buy and sell', () => {
    const fees = new NoFees()
    expect(fees.calculateBuyFee(10_000, 10, 1000)).toBe(0)
    expect(fees.calculateSellFee(10_000, 10, 1000)).toBe(0)
  })
})

describe('AShareFeeModel', () => {
  test('charges minimum commission on small buy orders', () => {
    const fees = new AShareFeeModel()
    const amount = 1000
    const fee = fees.calculateBuyFee(amount, 10, 100)
    expect(fee).toBeGreaterThan(0)
    expect(fee).toBeGreaterThanOrEqual(5)
  })

  test('sell fee includes stamp duty', () => {
    const fees = new AShareFeeModel()
    const amount = 10_000
    const buyFee = fees.calculateBuyFee(amount, 10, 1000)
    const sellFee = fees.calculateSellFee(amount, 10, 1000)
    expect(sellFee).toBeGreaterThan(buyFee)
  })

  test('uses custom rates when provided', () => {
    const fees = new AShareFeeModel({
      commissionRate: 0.001,
      minCommission: 1,
      stampDutyRate: 0,
      transferFeeRate: 0,
    })
    expect(fees.calculateBuyFee(10_000, 10, 1000)).toBe(10)
    expect(fees.calculateSellFee(10_000, 10, 1000)).toBe(10)
  })
})
