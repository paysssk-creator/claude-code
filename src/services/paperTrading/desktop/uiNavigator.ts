/**
 * Thin wrapper around computer-use MCP tools for desktop A-share trading.
 *
 * The navigator is intentionally stateless and testable: it receives a
 * `toolClient` that performs the actual MCP calls and an optional `parser`
 * that turns screenshots / accessibility text into structured data.
 */

import type {
  AppProfile,
  MarketDataRegion,
  OrderFormStep,
} from './appProfiles.js'
import type { MarketData, Position } from '../types.js'

export interface ScreenshotData {
  /** Base64-encoded PNG image, when available. */
  base64Image?: string
  /** Accessibility snapshot text or OCR result, when available. */
  text?: string
}

export interface ComputerUseToolClient {
  /** Call a computer-use MCP tool by its short name (e.g. 'screenshot'). */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
}

export type ScreenshotParser = <T>(
  screenshot: ScreenshotData,
  instruction: string,
) => Promise<T>

export interface UINavigatorOptions {
  profile: AppProfile
  client: ComputerUseToolClient
  /** Parser for extracting structured data from screenshots. */
  parser: ScreenshotParser
}

export interface PortfolioSnapshot {
  cash: number
  positions: Position[]
}

export interface DesktopUINavigator {
  requestAccess(reason: string): Promise<void>
  openAndBind(): Promise<void>
  navigateToPaperTrading(): Promise<void>
  unbind(): Promise<void>
  readPortfolio(): Promise<PortfolioSnapshot>
  readMarketData(symbol: string): Promise<MarketData>
  placePaperOrder(order: {
    symbol: string
    side: 'buy' | 'sell'
    price: number
    quantity: number
  }): Promise<void>
}

function isWindows(): boolean {
  return process.platform === 'win32'
}

export class UINavigator implements DesktopUINavigator {
  private readonly profile: AppProfile
  private readonly client: ComputerUseToolClient
  private readonly parser: ScreenshotParser

  constructor(options: UINavigatorOptions) {
    this.profile = options.profile
    this.client = options.client
    this.parser = options.parser
  }

  async requestAccess(reason: string): Promise<void> {
    await this.client.callTool('request_access', {
      apps: [this.profile.displayName],
      reason,
      clipboardRead: true,
      clipboardWrite: true,
    })
  }

  async openAndBind(): Promise<void> {
    await this.client.callTool('open_application', {
      app: this.profile.displayName,
    })
    if (isWindows()) {
      await this.client.callTool('bind_window', {
        action: 'bind',
        title: this.profile.windowTitle,
      })
    }
  }

  async unbind(): Promise<void> {
    if (isWindows()) {
      await this.client.callTool('bind_window', { action: 'unbind' })
    }
  }

  async screenshot(): Promise<ScreenshotData> {
    const result = (await this.client.callTool('screenshot', {})) as {
      base64Image?: string
      text?: string
    }
    return {
      base64Image: result.base64Image,
      text: result.text,
    }
  }

  private async clickElement(name: string): Promise<void> {
    if (isWindows()) {
      await this.client.callTool('click_element', { name })
    } else {
      throw new Error(
        `Element-based clicking is only supported on Windows. Target: ${name}`,
      )
    }
  }

  private async typeIntoElement(name: string, text: string): Promise<void> {
    if (isWindows()) {
      await this.client.callTool('type_into_element', { name, text })
    } else {
      throw new Error(
        `Element-based typing is only supported on Windows. Target: ${name}`,
      )
    }
  }

  private async wait(seconds = 0.5): Promise<void> {
    await this.client.callTool('wait', { duration: seconds })
  }

  async navigateToPaperTrading(): Promise<void> {
    for (const menuItem of this.profile.selectors.paperTradingMenuPath) {
      await this.clickElement(menuItem)
      await this.wait(0.5)
    }
    const shot = await this.screenshot()
    await this.guardAgainstRealMoney(shot)
  }

  private async guardAgainstRealMoney(shot: ScreenshotData): Promise<void> {
    const text = shot.text ?? ''
    for (const warning of this.profile.selectors.realMoneyWarningText) {
      if (text.includes(warning)) {
        // Some apps show both paper and real tabs; only fail if we are NOT
        // in the paper-trading confirmation area.
        const confirmed =
          this.profile.selectors.paperTradingConfirmationText.some(t =>
            text.includes(t),
          )
        if (!confirmed) {
          throw new Error(
            `Refusing to trade: real-money UI detected (${warning}). ` +
              'Navigate to paper/simulation trading mode first.',
          )
        }
      }
    }
  }

  async readPortfolio(): Promise<PortfolioSnapshot> {
    const shot = await this.screenshot()
    await this.guardAgainstRealMoney(shot)
    return this.parser<PortfolioSnapshot>(
      shot,
      'Extract the paper-trading account cash balance and stock positions from this screenshot. ' +
        'Return JSON: { "cash": number, "positions": [{ "symbol": string, "quantity": number, "averageCost": number }] }. ' +
        'Use only the visible paper/simulation account data.',
    )
  }

  async readMarketData(symbol: string): Promise<MarketData> {
    // Best-effort navigation to the symbol quote page. On Windows we can try
    // to focus a search box and type the symbol; otherwise we rely on the app
    // already showing the quote.
    if (isWindows()) {
      try {
        await this.client.callTool('type_into_element', {
          name: this.profile.selectors.symbolInputLabel,
          text: symbol,
        })
        await this.client.callTool('key', { text: 'Return' })
        await this.wait(1)
      } catch {
        // Fall through to screenshot-based parsing if the search box is absent.
      }
    }

    const shot = await this.screenshot()
    const regions = this.profile.marketDataRegions
    const prompt =
      `Extract market data for symbol ${symbol} from this screenshot. ` +
      `Return JSON: { "open": number, "high": number, "low": number, "close": number, ` +
      `"volume": number, "timestamp": string (ISO 8601) }. ` +
      `Use these labels as hints: latest price = "${regions.latestPrice.label}", ` +
      `open = "${regions.open.label}", high = "${regions.high.label}", ` +
      `low = "${regions.low.label}", previous close = "${regions.close.label}", ` +
      `volume = "${regions.volume.label}".`

    const parsed = await this.parser<MarketData>(shot, prompt)
    return { ...parsed, symbol }
  }

  async placePaperOrder(order: {
    symbol: string
    side: 'buy' | 'sell'
    price: number
    quantity: number
  }): Promise<void> {
    const shot = await this.screenshot()
    await this.guardAgainstRealMoney(shot)

    const buttonName =
      order.side === 'buy'
        ? this.profile.selectors.buyButton
        : this.profile.selectors.sellButton
    await this.clickElement(buttonName)
    await this.wait(0.3)

    for (const step of this.profile.orderFormSteps) {
      const target = step.target
        .replace('{symbol}', order.symbol)
        .replace('{price}', order.price.toFixed(2))
        .replace('{quantity}', order.quantity.toString())
      const value = step.value
        ?.replace('{symbol}', order.symbol)
        .replace('{price}', order.price.toFixed(2))
        .replace('{quantity}', order.quantity.toString())

      switch (step.action) {
        case 'click':
          await this.clickElement(target)
          break
        case 'type':
          if (value === undefined) {
            throw new Error(`Order form step missing value: ${step.target}`)
          }
          await this.typeIntoElement(target, value)
          break
        case 'wait':
          await this.wait(0.5)
          break
        case 'select':
          // Not used by bundled profiles; reserved for custom profiles.
          break
      }
      await this.wait(0.2)
    }

    const confirmShot = await this.screenshot()
    await this.guardAgainstRealMoney(confirmShot)
    const confirmText = confirmShot.text ?? ''
    const success = this.profile.selectors.successConfirmationText.some(t =>
      confirmText.includes(t),
    )
    if (!success) {
      throw new Error(
        `Paper order submission could not be verified for ${order.symbol}. ` +
          'Expected success confirmation text was not found.',
      )
    }
  }
}
