import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as browser from '../src/lib/harness-adapter.ts'
import * as server from '../server/src/harness-router.ts'

const context = {
  products: [{ id: 'beef', name: '牛肉', description: '鲜切', category: 'meat', price: 42 }],
  cart: [1, 2, 3].map((n) => ({
    uid: `line-${n}`, productId: `tiny-${n}`, name: `小菜${n}`, price: 0.05,
    quantity: 1, spec: '标准份', orderedBy: '顾客',
  })),
  soldOut: [], diners: ['顾客'], language: 'zh', currency: 'USD' as const,
}

for (const [name, adapter] of [['browser', browser], ['server', server]] as const) {
  test(`${name}: cart reference subtotal sums rounded lines and preserves the CNY subtotal`, () => {
    const output = adapter.executeToolCall('get_cart', {}, context).output
    assert.match(output, /人民币.*CNY.*¥0\.15/)
    assert.match(output, /合计[^\n]*USD 0\.03/)
    assert.equal(output.match(/行金额[^\n]*USD 0\.01/g)?.length, 3)
    assert.match(output, /仅供参考/)
  })
}

for (const [name, adapter] of [['browser', browser], ['server', server]] as const) {
  test(`${name}: system context states display currency, demo rates and CNY pricing`, () => {
    const instructions = adapter.buildSystemInstructions(context)
    assert.match(instructions, /Display currency: USD/)
    assert.match(instructions, /1 CNY = 0\.14 USD, 0\.13 EUR, 1\.10 HKD/)
    assert.match(instructions, /定价与结算币种: CNY/)
    assert.match(instructions, /人民币原价 CNY ¥42\.00.*USD 5\.88/)
    assert.match(instructions, /合计[^\n]*USD 0\.03/)
    assert.match(adapter.buildSystemInstructions({ ...context, currency: undefined }), /Display currency: CNY/)
  })

  test(`${name}: catalog and half-portion add use reference amounts while action price stays CNY`, () => {
    for (const [tool, args] of [
      ['search_menu', { query: '牛肉' }],
      ['get_menu_by_category', { category: 'meat' }],
      ['get_product_detail', { product_id: 'beef' }],
    ] as const) {
      const output = adapter.executeToolCall(tool, args, context).output
      assert.match(output, /人民币原价 CNY ¥42\.00.*参考 USD 5\.88/)
    }
    const added = adapter.executeToolCall('add_to_cart', { product_id: 'beef', portion: 'Half', quantity: 2 }, context)
    assert.equal(added.action?.payload.price, 24)
    assert.equal(added.action?.payload.quantity, 2)
    assert.match(added.output, /人民币原价 CNY ¥24\.00.*参考 USD 3\.36/)
    const cny = adapter.executeToolCall('get_product_detail', { product_id: 'beef' }, { ...context, currency: undefined })
    assert.match(cny.output, /人民币原价 CNY ¥42\.00/)
    assert.doesNotMatch(cny.output, /USD/)
  })
}

function sse(output: Array<Record<string, unknown>>, id: string): Response {
  return new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { id, output } })}\n\n`, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

for (const [name, adapter] of [['browser', browser], ['server', server]] as const) {
  test(`${name}: an in-flight turn locks its currency and quotes cart changes without mutating its caller`, async () => {
    const originalFetch = globalThis.fetch
    const turnContext: browser.ProductStateContext = { ...context, cart: [] }
    const requests: Array<{ instructions: string; metadata: { currency: string }; input: Array<{ output: string }>; previous_response_id: string }> = []
    globalThis.fetch = async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)))
      if (requests.length === 1) {
        // Changing the caller while the request is in flight must not change this turn.
        turnContext.currency = 'EUR'
        return sse([
          { type: 'function_call', call_id: 'add', name: 'add_to_cart', arguments: '{"product_id":"beef","portion":"Half"}' },
          { type: 'function_call', call_id: 'cart', name: 'get_cart', arguments: '{}' },
        ], 'resp_tool')
      }
      return sse([], 'resp_done')
    }
    try {
      await adapter.chatWithHarness({
        message: '来半份牛肉', apiKey: 'mock', featureKey: 'smart_order_assistant',
        previousResponseId: 'resp_previous', context: turnContext, onEvent: () => {},
      })
      assert.equal(requests.length, 2)
      for (const request of requests) {
        assert.equal(request.metadata.currency, 'USD')
        assert.match(request.instructions, /Display currency: USD/)
      }
      assert.equal(requests[0].previous_response_id, 'resp_previous')
      assert.match(requests[1].input[0].output, /参考 USD 3\.36/)
      assert.match(requests[1].input[1].output, /合计[^\n]*人民币 CNY ¥24\.00.*USD 3\.36/)
      assert.match(requests[1].instructions, /合计[^\n]*USD 3\.36/)
      assert.deepEqual(turnContext.cart, [])
      // Continuing the same response chain uses the new turn's selected currency.
      await adapter.chatWithHarness({
        message: '现在用欧元看', apiKey: 'mock', featureKey: 'smart_order_assistant',
        previousResponseId: 'resp_done', context: turnContext, onEvent: () => {},
      })
      assert.equal(requests[2].metadata.currency, 'EUR')
      assert.match(requests[2].instructions, /Display currency: EUR/)
      assert.equal(requests[2].previous_response_id, 'resp_done')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
}

for (const [name, adapter] of [['browser', browser], ['server', server]] as const) {
  test(`${name}: sequential tool rounds keep the selected currency and return the updated cart quote`, async () => {
    const originalFetch = globalThis.fetch
    const requests: Array<{ input: string | Array<{ output: string }>; instructions: string; metadata: { currency: string } }> = []
    globalThis.fetch = async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)))
      if (requests.length === 1) return sse([
        { type: 'function_call', call_id: 'add', name: 'add_to_cart', arguments: '{"product_id":"beef"}' },
      ], 'resp_add')
      if (requests.length === 2) return sse([
        { type: 'function_call', call_id: 'cart', name: 'get_cart', arguments: '{}' },
      ], 'resp_cart')
      return sse([], 'resp_final')
    }
    try {
      await adapter.chatWithHarness({
        message: '加牛肉后查购物车', apiKey: 'mock', featureKey: 'smart_order_assistant',
        context: { ...context, currency: 'HKD', cart: [] }, onEvent: () => {},
      })
      assert.equal(requests.length, 3)
      for (const request of requests) {
        assert.equal(request.metadata.currency, 'HKD')
        assert.match(request.instructions, /Display currency: HKD/)
      }
      assert.notEqual(typeof requests[2].input, 'string')
      assert.match((requests[2].input as Array<{ output: string }>)[0].output, /合计[^\n]*人民币 CNY ¥42\.00.*HKD 46\.20/)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
}
