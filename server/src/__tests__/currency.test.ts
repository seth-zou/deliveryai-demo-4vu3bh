import { it } from 'node:test'
import assert from 'node:assert/strict'
import { quoteAmounts, formatMoney, formatMinor, normalizeCurrency, isCurrencyCode, portionPrice } from '../../../shared/currency.js'

it('参考小计等于逐行舍入金额之和，而不是人民币小计直接换算', () => {
  assert.deepEqual(quoteAmounts([
    { price: 0.04, quantity: 1 },
    { price: 0.04, quantity: 1 },
    { price: 0.04, quantity: 1 },
  ], 'USD'), {
    currency: 'USD', lineAmounts: [1, 1, 1], subtotal: 3, discount: 0, payable: 3,
    cny: { lineAmounts: [4, 4, 4], subtotal: 12, discount: 0, payable: 12 },
  })
})

it('四币种使用明确的两位小数格式，非法币种回退人民币', () => {
  assert.deepEqual(['CNY', 'USD', 'EUR', 'HKD'].map((currency) =>
    formatMoney(42, normalizeCurrency(currency))), ['¥42.00', 'USD 5.88', 'EUR 5.46', 'HKD 46.20'])
  assert.equal(formatMinor(3, 'USD'), 'USD 0.03')
  assert.equal(formatMoney(1.005), '¥1.01')
  assert.equal(normalizeCurrency('usd'), 'CNY')
  assert.equal(normalizeCurrency(null), 'CNY')
  assert.equal(normalizeCurrency('BTC'), 'CNY')
  assert.equal(isCurrencyCode('USD'), true)
  assert.equal(isCurrencyCode({}), false)
})

it('满200减20依据人民币小计判断，并单独换算优惠', () => {
  assert.deepEqual(quoteAmounts([
    { price: 199.96, quantity: 1 },
    { price: 0.04, quantity: 1 },
  ], 'USD', true), {
    currency: 'USD', lineAmounts: [2799, 1], subtotal: 2800, discount: 280, payable: 2520,
    cny: { lineAmounts: [19996, 4], subtotal: 20000, discount: 2000, payable: 18000 },
  })
})

it('优惠边界、购物车未优惠小计和空购物车保持人民币规则', () => {
  const belowThreshold = quoteAmounts([{ price: 199.99, quantity: 1 }], 'EUR', true)
  assert.deepEqual([belowThreshold.subtotal, belowThreshold.discount, belowThreshold.payable], [2600, 0, 2600])
  const cart = quoteAmounts([{ price: 100, quantity: 2 }], 'HKD')
  assert.deepEqual([cart.subtotal, cart.discount, cart.payable], [22000, 0, 22000])
  assert.deepEqual(quoteAmounts([], 'CNY', true), {
    currency: 'CNY', lineAmounts: [], subtotal: 0, discount: 0, payable: 0,
    cny: { lineAmounts: [], subtotal: 0, discount: 0, payable: 0 },
  })
})

it('数量按整行换算而不是逐份舍入，人民币小数不会累计误差', () => {
  const quote = quoteAmounts([{ price: 0.04, quantity: 3 }, { price: 0.1, quantity: 3 }], 'USD')
  assert.deepEqual(quote.lineAmounts, [2, 4])
  assert.equal(quote.subtotal, 6)
  assert.equal(quote.cny.subtotal, 42)
})

it('半份仍按人民币基价58%取整，并作为人民币价格参与报价', () => {
  const quote = quoteAmounts([{ price: portionPrice(42, true), quantity: 2 }], 'USD')
  assert.deepEqual([quote.cny.subtotal, quote.subtotal], [4800, 672])
  assert.equal(formatMoney(portionPrice(42, false), 'CNY'), '¥42.00')
})
