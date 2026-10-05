/** Prices remain CNY yuan; every amount returned by quoteAmounts is integer minor units. */
export type CurrencyCode = 'CNY' | 'USD' | 'EUR' | 'HKD'

export const CURRENCIES: readonly CurrencyCode[] = Object.freeze(['CNY', 'USD', 'EUR', 'HKD'])

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && CURRENCIES.includes(value as CurrencyCode)
}

export function normalizeCurrency(value: unknown): CurrencyCode {
  return isCurrencyCode(value) ? value : 'CNY'
}

export const DEMO_RATES: Readonly<Record<CurrencyCode, number>> = Object.freeze({
  CNY: 1, USD: 0.14, EUR: 0.13, HKD: 1.10,
})

export interface QuoteItem {
  price: number
  quantity: number
}

export interface Amounts {
  lineAmounts: number[]
  subtotal: number
  discount: number
  payable: number
}

export interface MoneyQuote extends Amounts {
  currency: CurrencyCode
  /** The original CNY amounts, in fen (not yuan). */
  cny: Amounts
}

const toMinor = (yuan: number) => Math.round((yuan + Number.EPSILON) * 100)
const convertMinor = (cnyMinor: number, currency: CurrencyCode) =>
  Math.round(cnyMinor * Math.round(DEMO_RATES[currency] * 100) / 100)

/** Format an already-quoted integer minor amount without converting it again. */
export function formatMinor(minor: number, currency: CurrencyCode = 'CNY'): string {
  const amount = (minor / 100).toFixed(2)
  return currency === 'CNY' ? `¥${amount}` : `${currency} ${amount}`
}

/** Convert a base CNY yuan amount once, then format it for display. */
export function formatMoney(cnyYuan: number, currency: CurrencyCode = 'CNY'): string {
  return formatMinor(convertMinor(toMinor(cnyYuan), currency), currency)
}

/** Preserve the demo's existing CNY portion pricing before any currency conversion. */
export function portionPrice(baseCny: number, halfPortion: boolean): number {
  return halfPortion ? Math.round(baseCny * 0.58) : baseCny
}

/** Convert each CNY line before summing so displayed lines always add up. */
export function quoteAmounts(items: readonly QuoteItem[], currency: CurrencyCode = 'CNY', applyDiscount = false): MoneyQuote {
  const cnyLineAmounts = items.map((item) => toMinor(item.price * item.quantity))
  const cnySubtotal = cnyLineAmounts.reduce((sum, amount) => sum + amount, 0)
  const cnyDiscount = applyDiscount && cnySubtotal >= 20000 ? 2000 : 0
  const lineAmounts = cnyLineAmounts.map((amount) => convertMinor(amount, currency))
  const subtotal = lineAmounts.reduce((sum, amount) => sum + amount, 0)
  const discount = convertMinor(cnyDiscount, currency)
  return {
    currency, lineAmounts, subtotal, discount, payable: subtotal - discount,
    cny: { lineAmounts: cnyLineAmounts, subtotal: cnySubtotal, discount: cnyDiscount, payable: cnySubtotal - cnyDiscount },
  }
}
