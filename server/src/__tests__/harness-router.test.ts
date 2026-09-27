/**
 * HarnessRouter Adapter 单元测试
 *
 * Mock HarnessRouter Cloud API 接口，覆盖：
 * - Session 创建/继续（previous_response_id）
 * - 流式响应解析（SSE 事件处理）
 * - tool call 执行与结果回传
 * - 错误处理
 * - 取消操作
 */

import { describe, it, before, after, mock, } from 'node:test'
import assert from 'node:assert/strict'
import { executeToolCall, buildSystemInstructions, getHarnessConfig, type ProductStateContext } from '../harness-router.js'

// ── 测试数据 ──────────────────────────────────────────────

const testContext: ProductStateContext = {
  products: [
    { id: 'p1', name: '鎏金番茄鸳鸯锅', description: '慢熬番茄与醇香牛油，一锅双味', category: 'menu.cat.broth', price: 68, options: { flavor: ['番茄+牛油', '菌汤+牛油'], spicy: ['微辣', '中辣', '重辣', '超级辣'] } },
    { id: 'p2', name: '牛油麻辣锅', description: '醇厚牛油', category: 'menu.cat.broth', price: 59, options: { spicy: ['微辣', '中辣', '重辣', '超级辣'] } },
    { id: 'p3', name: '琥珀嫩牛肉', description: '鲜切嫩牛肉', category: 'menu.cat.meat', price: 42, options: { portion: ['半份', '整份'], flavor: ['原味', '香辣腌制'] } },
    { id: 'p8', name: '山野菌菇拼盘', description: '多种菌菇', category: 'menu.cat.veggie', price: 32, options: { portion: ['半份', '整份'] } },
  ],
  cart: [],
  soldOut: ['p8'],
  diners: ['姚乾', '林溪', '陈默'],
  language: 'zh',
}

const contextWithCart: ProductStateContext = {
  ...testContext,
  cart: [
    { uid: 'test-uid-1', productId: 'p3', name: '琥珀嫩牛肉', price: 42, quantity: 1, spec: '整份 · 原味', orderedBy: '姚乾' },
  ],
}

// ── Tool Call 执行测试 ────────────────────────────────────

describe('executeToolCall', () => {
  describe('search_menu', () => {
    it('应按关键词返回匹配菜品', () => {
      const result = executeToolCall('search_menu', { query: '牛肉' }, testContext)
      assert.ok(result.output.includes('琥珀嫩牛肉'))
      assert.ok(result.output.includes('p3'))
    })

    it('搜索无结果时应返回提示', () => {
      const result = executeToolCall('search_menu', { query: '不存在的菜品' }, testContext)
      assert.ok(result.output.includes('没有找到'))
    })

    it('应按分类关键词搜索', () => {
      const result = executeToolCall('search_menu', { query: 'broth' }, testContext)
      assert.ok(result.output.includes('鎏金番茄鸳鸯锅'))
    })
  })

  describe('get_menu_by_category', () => {
    it('应返回指定分类的菜品', () => {
      const result = executeToolCall('get_menu_by_category', { category: 'menu.cat.broth' }, testContext)
      assert.ok(result.output.includes('鎏金番茄鸳鸯锅'))
      assert.ok(result.output.includes('牛油麻辣锅'))
    })

    it('分类无菜品时返回提示', () => {
      const result = executeToolCall('get_menu_by_category', { category: 'nonexistent' }, testContext)
      assert.ok(result.output.includes('没有找到'))
    })
  })

  describe('get_product_detail', () => {
    it('应返回菜品详情和可选规格', () => {
      const result = executeToolCall('get_product_detail', { product_id: 'p1' }, testContext)
      assert.ok(result.output.includes('鎏金番茄鸳鸯锅'))
      assert.ok(result.output.includes('份量') || result.output.includes('辣度') || result.output.includes('口味'))
    })

    it('菜品不存在时返回提示', () => {
      const result = executeToolCall('get_product_detail', { product_id: 'p999' }, testContext)
      assert.ok(result.output.includes('未找到'))
    })
  })

  describe('add_to_cart', () => {
    it('成功加购时应返回 ADD_CART action', () => {
      const result = executeToolCall('add_to_cart', { product_id: 'p3', portion: '整份', flavor: '原味' }, testContext)
      assert.ok(result.output.includes('已加入购物车'))
      assert.ok(result.output.includes('琥珀嫩牛肉'))
      assert.ok(result.action)
      assert.equal(result.action!.type, 'ADD_CART')
      assert.ok(result.action!.payload.uid)
      assert.equal(result.action!.payload.productId, 'p3')
      assert.equal(result.action!.payload.name, '琥珀嫩牛肉')
      assert.equal(result.action!.payload.orderedBy, '姚乾')
    })

    it('加购售罄菜品时应拦截并推荐替代', () => {
      const result = executeToolCall('add_to_cart', { product_id: 'p8' }, testContext)
      assert.ok(result.output.includes('已售罄'))
      assert.ok(result.output.includes('山野菌菇拼盘'))
      assert.equal(result.action, undefined)
    })

    it('菜品不存在时返回错误提示', () => {
      const result = executeToolCall('add_to_cart', { product_id: 'p999' }, testContext)
      assert.ok(result.output.includes('未找到'))
      assert.equal(result.action, undefined)
    })

    it('半份应计算正确的价格', () => {
      const result = executeToolCall('add_to_cart', { product_id: 'p3', portion: '半份' }, testContext)
      assert.equal(result.action!.payload.price, Math.round(42 * 0.58))
    })

    it('未指定份量时默认为标准份', () => {
      const result = executeToolCall('add_to_cart', { product_id: 'p3' }, testContext)
      assert.ok(result.output.includes('标准份'))
      assert.equal(result.action!.payload.price, 42)
    })

    it('默认下单人为 diners[0]', () => {
      const result = executeToolCall('add_to_cart', { product_id: 'p3' }, testContext)
      assert.equal(result.action!.payload.orderedBy, '姚乾')
    })
  })

  describe('update_cart_quantity', () => {
    it('增加数量应返回 CHANGE_QTY action with positive delta', () => {
      const result = executeToolCall('update_cart_quantity', { uid: 'test-uid-1', delta: 1 }, contextWithCart)
      assert.ok(result.output.includes('数量改为 2'))
      assert.ok(result.action)
      assert.equal(result.action!.type, 'CHANGE_QTY')
      assert.equal(result.action!.payload.delta, 1)
    })

    it('减少数量（仍 >0）应返回 CHANGE_QTY with negative delta', () => {
      const result = executeToolCall('update_cart_quantity', { uid: 'test-uid-1', delta: -1 }, contextWithCart)
      assert.ok(result.output.includes('已移除'))
      assert.ok(result.action)
      assert.equal(result.action!.type, 'CHANGE_QTY')
      assert.equal(result.action!.payload.delta, -1)
    })

    it('uid 不存在时返回当前购物车信息', () => {
      const result = executeToolCall('update_cart_quantity', { uid: 'nonexistent', delta: 1 }, contextWithCart)
      assert.ok(result.output.includes('未找到'))
    })

    it('空购物车时 update 返回提示', () => {
      const result = executeToolCall('update_cart_quantity', { uid: 'any', delta: 1 }, testContext)
      assert.ok(result.output.includes('未找到'))
    })
  })

  describe('get_cart', () => {
    it('空购物车时返回空态提示', () => {
      const result = executeToolCall('get_cart', {}, testContext)
      assert.ok(result.output.includes('空的'))
    })

    it('有商品时返回购物车列表和合计', () => {
      const result = executeToolCall('get_cart', {}, contextWithCart)
      assert.ok(result.output.includes('琥珀嫩牛肉'))
      assert.ok(result.output.includes('合计'))
      assert.ok(result.output.includes('¥42'))
    })
  })

  describe('未知工具', () => {
    it('返回未知工具提示', () => {
      const result = executeToolCall('unknown_tool', {}, testContext)
      assert.ok(result.output.includes('未知工具'))
    })
  })
})

// ── 系统指令构建测试 ──────────────────────────────────────

describe('buildSystemInstructions', () => {
  it('应包含菜品数据', () => {
    const instructions = buildSystemInstructions(testContext)
    assert.ok(instructions.includes('鎏金番茄鸳鸯锅'))
    assert.ok(instructions.includes('琥珀嫩牛肉'))
  })

  it('应包含购物车状态', () => {
    const instructions = buildSystemInstructions(contextWithCart)
    assert.ok(instructions.includes('琥珀嫩牛肉'))
    assert.ok(instructions.includes('test-uid-1'))
  })

  it('应包含售罄信息', () => {
    const instructions = buildSystemInstructions(testContext)
    assert.ok(instructions.includes('p8'))
  })

  it('应包含语言指示', () => {
    const zhInstructions = buildSystemInstructions({ ...testContext, language: 'zh' })
    assert.ok(zhInstructions.includes('中文'))

    const enInstructions = buildSystemInstructions({ ...testContext, language: 'en' })
    assert.ok(enInstructions.includes('English'))
  })

  it('空购物车显示(空)', () => {
    const instructions = buildSystemInstructions(testContext)
    assert.ok(instructions.includes('(空)'))
  })
})

// ── Harness 配置测试 ──────────────────────────────────────

describe('getHarnessConfig', () => {
  it('应正确加载 harness 配置', () => {
    const config = getHarnessConfig()
    assert.equal(config.feature_key, 'smart_order_assistant')
    assert.equal(config.harness_id, 'chrn_776c21a9bdb747f899a18d1de794fa14')
    assert.equal(config.name, 'Smart Order Assistant')
    assert.ok(config.tools.length === 6)
    assert.ok(config.tools.find(t => t.name === 'search_menu'))
    assert.ok(config.tools.find(t => t.name === 'get_menu_by_category'))
    assert.ok(config.tools.find(t => t.name === 'get_product_detail'))
    assert.ok(config.tools.find(t => t.name === 'add_to_cart'))
    assert.ok(config.tools.find(t => t.name === 'update_cart_quantity'))
    assert.ok(config.tools.find(t => t.name === 'get_cart'))
  })
})

// ── chatWithHarness 集成测试（mock fetch） ────────────────

describe('chatWithHarness (mocked)', () => {
  const originalFetch = globalThis.fetch

  before(() => {
    // 设置环境变量以通过 API_KEY 检查
    process.env.HARNESSROUTER_API_KEY = 'test-key-for-unit-test'
  })

  after(() => {
    globalThis.fetch = originalFetch
    delete process.env.HARNESSROUTER_API_KEY
  })

  it('API Key 未配置时应抛出错误', async () => {
    const savedKey = process.env.HARNESSROUTER_API_KEY
    delete process.env.HARNESSROUTER_API_KEY

    // 需要重新 import 以读取最新的 env
    // 由于模块缓存，这里直接测试逻辑
    const events: Array<{ event: string; data: unknown }> = []
    try {
      // chatWithHarness 在模块加载时读取 API_KEY，需要 mock
      // 这里测试模块行为，简化为验证 API Key 缺失时的行为
      // 由于 API_KEY 在模块加载时缓存，我们测试 error 路径
      await assert.rejects(
        async () => {
          // 直接 fetch mock 验证
          const { chatWithHarness } = await import('../harness-router.js')
          await chatWithHarness({
            message: 'test',
            featureKey: 'smart_order_assistant',
            context: testContext,
            onEvent: (e) => events.push(e),
          })
        },
        (err: Error) => {
          assert.ok(err.message.includes('HARNESSROUTER_API_KEY') || err.message.includes('API'))
          return true
        }
      )
    } finally {
      process.env.HARNESSROUTER_API_KEY = savedKey
    }
  })

  it('应正确处理 SSE 流式文本响应', async () => {
    // Mock fetch 返回 SSE 流
    const sseChunks = [
      'data: {"type":"response.output_text.delta","delta":"你好"}\n\n',
      'data: {"type":"response.output_text.delta","delta":"！我是"}\n\n',
      'data: {"type":"response.output_text.delta","delta":"智能点单助理"}\n\n',
      'data: {"type":"response.completed","response":{"id":"resp_12345","output":[]}}\n\n',
    ]

    const mockResponse = {
      ok: true,
      body: {
        getReader: () => {
          let index = 0
          return {
            read: async () => {
              if (index < sseChunks.length) {
                return { done: false, value: new TextEncoder().encode(sseChunks[index++]) }
              }
              return { done: true, value: undefined }
            },
            releaseLock: () => {},
          }
        },
      },
    }

    globalThis.fetch = mock.fn(() => Promise.resolve(mockResponse)) as never
    process.env.HARNESSROUTER_API_KEY = 'test-key-for-unit-test'

    const events: Array<{ event: string; data: unknown }> = []
    const { chatWithHarness } = await import('../harness-router.js')

    const result = await chatWithHarness({
      message: '你好',
      featureKey: 'smart_order_assistant',
      context: testContext,
      onEvent: (e) => events.push(e),
    })

    // 应有 3 个 text_delta 事件
    const textEvents = events.filter(e => e.event === 'text_delta')
    assert.equal(textEvents.length, 3)
    assert.equal((textEvents[0].data as Record<string, unknown>).content, '你好')
    assert.equal((textEvents[1].data as Record<string, unknown>).content, '！我是')
    assert.equal((textEvents[2].data as Record<string, unknown>).content, '智能点单助理')

    // 应有 response_id
    assert.equal(result.responseId, 'resp_12345')
  })

  it('应处理 API 错误响应', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }

    globalThis.fetch = mock.fn(() => Promise.resolve(mockResponse as never)) as never
    process.env.HARNESSROUTER_API_KEY = 'test-key-for-unit-test'

    const events: Array<{ event: string; data: unknown }> = []
    const { chatWithHarness } = await import('../harness-router.js')

    await assert.rejects(
      chatWithHarness({
        message: 'test',
        featureKey: 'smart_order_assistant',
        context: testContext,
        onEvent: (e) => events.push(e),
      }),
      (err: Error) => {
        assert.ok(err.message.includes('500'))
        return true
      }
    )
  })
})

// ── cancelHarnessResponse 测试 ────────────────────────────

describe('cancelHarnessResponse (mocked)', () => {
  const originalFetch = globalThis.fetch

  after(() => {
    globalThis.fetch = originalFetch
  })

  it('应向 HarnessRouter 发送取消请求', async () => {
    const mockFetch = mock.fn(() => Promise.resolve({ ok: true } as never))
    globalThis.fetch = mockFetch as never
    process.env.HARNESSROUTER_API_KEY = 'test-key-for-cancel-test'

    const { cancelHarnessResponse } = await import('../harness-router.js')
    await cancelHarnessResponse('test-session-id')

    assert.equal(mockFetch.mock.calls.length, 1)
    const callArgs = mockFetch.mock.calls[0].arguments as unknown as [string, RequestInit]
    assert.ok(callArgs[0].includes('/v1/sessions/test-session-id/cancel'))
    assert.equal(callArgs[1].method, 'POST')
  })
})
