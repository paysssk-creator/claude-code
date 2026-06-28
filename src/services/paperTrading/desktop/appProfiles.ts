/**
 * Desktop trading application profiles.
 *
 * Profiles describe how to locate, navigate, and interact with Chinese
 * retail trading desktop applications in their paper/simulation trading mode.
 * All values are textual selectors (menu paths, button labels, window titles)
 * intended for computer-use MCP screenshot / accessibility interactions.
 */

export interface AppSelectors {
  /** Menu path to open the paper-trading panel, e.g. ['交易', '模拟炒股']. */
  paperTradingMenuPath: string[]
  /** Text/label of the paper-trading mode confirmation element. */
  paperTradingConfirmationText: string[]
  /** Button/label used to open the buy order form. */
  buyButton: string
  /** Button/label used to open the sell order form. */
  sellButton: string
  /** Label of the stock-code input field. */
  symbolInputLabel: string
  /** Label of the price input field. */
  priceInputLabel: string
  /** Label of the quantity input field. */
  quantityInputLabel: string
  /** Text on the submit/confirm order button. */
  submitOrderButton: string
  /** Text on the order confirmation dialog's confirm button. */
  confirmOrderButton: string
  /** Text appearing in the order-success confirmation. */
  successConfirmationText: string[]
  /** Text that indicates a real-money account flow (used as a stop guard). */
  realMoneyWarningText: string[]
}

export interface MarketDataRegion {
  /** Human-readable description of the region, e.g. 'latest price label'. */
  description: string
  /** Known accessibility label or nearby text in the UI. */
  label: string
}

export interface OrderFormStep {
  /** Type of interaction. */
  action: 'click' | 'type' | 'select' | 'wait'
  /** Target description (button label, input label, etc.). */
  target: string
  /** Optional value for type/select actions. */
  value?: string
}

export interface AppProfile {
  /** Profile identifier. */
  id: string
  /** Human-readable application name. */
  displayName: string
  /** Substring expected in the main application window title. */
  windowTitle: string
  /** Executable name used to launch the application. */
  exeName: string
  /** Free-form installation hints for the agent. */
  installationHint: string
  /** UI selectors for the application. */
  selectors: AppSelectors
  /** Regions/labels used to read market data from the UI. */
  marketDataRegions: Record<string, MarketDataRegion>
  /** Ordered steps to fill and submit a paper order form. */
  orderFormSteps: OrderFormStep[]
}

const THS_PROFILE: AppProfile = {
  id: 'ths',
  displayName: '同花顺',
  windowTitle: '同花顺',
  exeName: 'hexin.exe',
  installationHint:
    'Download from 10jqka.com.cn. Launch the main terminal and log in to a simulated/paper account.',
  selectors: {
    paperTradingMenuPath: ['交易', '模拟炒股'],
    paperTradingConfirmationText: ['模拟炒股', '模拟交易', '模拟账户'],
    buyButton: '买入',
    sellButton: '卖出',
    symbolInputLabel: '证券代码',
    priceInputLabel: '委托价格',
    quantityInputLabel: '委托数量',
    submitOrderButton: '买入下单',
    confirmOrderButton: '确定',
    successConfirmationText: ['委托成功', '已成', '已报'],
    realMoneyWarningText: ['实盘交易', '真实账户', '资金账号', '银证转账'],
  },
  marketDataRegions: {
    latestPrice: { description: 'Latest traded price', label: '最新价' },
    open: { description: 'Today open', label: '今开' },
    high: { description: 'Today high', label: '最高' },
    low: { description: 'Today low', label: '最低' },
    close: { description: 'Previous close', label: '昨收' },
    volume: { description: 'Today volume', label: '成交量' },
  },
  orderFormSteps: [
    { action: 'click', target: '证券代码' },
    { action: 'type', target: '证券代码', value: '{symbol}' },
    { action: 'click', target: '委托价格' },
    { action: 'type', target: '委托价格', value: '{price}' },
    { action: 'click', target: '委托数量' },
    { action: 'type', target: '委托数量', value: '{quantity}' },
    { action: 'click', target: '买入下单' },
    { action: 'wait', target: 'confirm dialog' },
    { action: 'click', target: '确定' },
  ],
}

const EASTMONEY_PROFILE: AppProfile = {
  id: 'eastmoney',
  displayName: '东方财富',
  windowTitle: '东方财富',
  exeName: 'Eastmoney.exe',
  installationHint:
    'Download from eastmoney.com. Launch the Choice terminal or the main trading client and log in to a simulated/paper account.',
  selectors: {
    paperTradingMenuPath: ['交易', '模拟炒股'],
    paperTradingConfirmationText: ['模拟炒股', '模拟交易', '模拟账户'],
    buyButton: '买入',
    sellButton: '卖出',
    symbolInputLabel: '代码',
    priceInputLabel: '价格',
    quantityInputLabel: '数量',
    submitOrderButton: '下单',
    confirmOrderButton: '确定',
    successConfirmationText: ['委托成功', '已成', '已报'],
    realMoneyWarningText: ['实盘交易', '真实账户', '资金账号', '银证转账'],
  },
  marketDataRegions: {
    latestPrice: { description: 'Latest traded price', label: '最新' },
    open: { description: 'Today open', label: '今开' },
    high: { description: 'Today high', label: '最高' },
    low: { description: 'Today low', label: '最低' },
    close: { description: 'Previous close', label: '昨收' },
    volume: { description: 'Today volume', label: '成交量' },
  },
  orderFormSteps: [
    { action: 'click', target: '代码' },
    { action: 'type', target: '代码', value: '{symbol}' },
    { action: 'click', target: '价格' },
    { action: 'type', target: '价格', value: '{price}' },
    { action: 'click', target: '数量' },
    { action: 'type', target: '数量', value: '{quantity}' },
    { action: 'click', target: '下单' },
    { action: 'wait', target: 'confirm dialog' },
    { action: 'click', target: '确定' },
  ],
}

const PROFILES = new Map<string, AppProfile>([
  [THS_PROFILE.id, THS_PROFILE],
  [EASTMONEY_PROFILE.id, EASTMONEY_PROFILE],
])

export function getAppProfile(id: string): AppProfile {
  const profile = PROFILES.get(id)
  if (!profile) {
    throw new Error(`Unknown desktop trading app profile: ${id}`)
  }
  return profile
}

export function listAppProfileIds(): string[] {
  return Array.from(PROFILES.keys())
}
