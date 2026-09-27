import { test, expect, type Page } from '@playwright/test'

/** Helper: navigate from app start to menu view (bind table + enter menu) */
async function gotoMenu(page: Page) {
  await page.goto('/')
  // Bind table - click table A08
  await page.getByRole('button', { name: /A08/ }).first().click()
  // Welcome page - enter menu
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
}

/** Helper: open AI assistant popup */
async function openAIAssistant(page: Page) {
  await gotoMenu(page)
  const floatBtn = page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ })
  await floatBtn.click()
  await expect(page.getByText(/你好！我是智能点单助理|Hi! I'm your smart order assistant/)).toBeVisible()
}

/** Helper: preset API Key to localStorage before page load */
async function presetApiKey(page: Page, key = 'test-mock-api-key') {
  await page.addInitScript((k) => {
    localStorage.setItem('harnessrouter_api_key', k)
  }, key)
}

/** Build SSE body: successful text streaming response */
function sseTextResponse(text: string, responseId = 'resp_mock_123'): string {
  return [
    `data: {"type":"response.output_text.delta","delta":${JSON.stringify(text)}}`,
    '',
    `data: {"type":"response.completed","response":{"id":"${responseId}"}}`,
    '',
  ].join('\n')
}

/** Build SSE body: function_call event for tool call */
function sseFunctionCall(
  callId: string,
  name: string,
  args: Record<string, unknown>,
  responseId = 'resp_mock_tool'
): string {
  return [
    `data: {"type":"response.output_item.added","item":{"type":"function_call","call_id":"${callId}","name":"${name}","arguments":${JSON.stringify(JSON.stringify(args))}}}`,
    '',
    `data: {"type":"response.completed","response":{"id":"${responseId}"}}`,
    '',
  ].join('\n')
}

test.describe('智能点单助理 - 直连 API Mock 测试（错误分类与流式响应）', () => {
  test.beforeEach(async ({ page }) => {
    await presetApiKey(page)
  })

  // ── REQ-001.1 / REQ-002.1: 直连 API 流式响应正常显示 ─────────

  test('AI-DIRECT-001: 直连 API 流式响应正常显示 AI 回复文本', async ({ page }) => {
    await page.route('**/api/chat*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseTextResponse('我推荐番茄牛肉锅底，味道鲜美！'),
      })
    })

    await openAIAssistant(page)
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('推荐一个锅底')
    await page.keyboard.press('Enter')

    // 验证用户消息显示
    await expect(page.getByText('推荐一个锅底').first()).toBeVisible()
    // 验证 AI 流式回复文本显示
    await expect(page.getByText('我推荐番茄牛肉锅底，味道鲜美！')).toBeVisible({ timeout: 10000 })
    // 验证不出现笼统错误
    await expect(page.getByText(/助理暂时无法响应，请重试|temporarily unavailable/i)).not.toBeVisible({ timeout: 3000 })
  })

  // ── REQ-004.2: 无效 API Key (401) ──────────────────────────

  test('AI-DIRECT-002: API 返回 401 时显示「API Key 无效，请检查配置」', async ({ page }) => {
    await page.route('**/api/chat*', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      })
    })

    await openAIAssistant(page)
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('推荐一个锅底')
    await page.keyboard.press('Enter')

    // 验证显示「API Key 无效，请检查配置」而非笼统错误
    await expect(page.getByText(/API Key 无效，请检查配置|Invalid API Key/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/助理暂时无法响应，请重试|temporarily unavailable/i)).not.toBeVisible({ timeout: 3000 })
  })

  // ── REQ-004.2: 无效 API Key (403) ──────────────────────────

  test('AI-DIRECT-003: API 返回 403 时显示「API Key 无效，请检查配置」', async ({ page }) => {
    await page.route('**/api/chat*', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden' }),
      })
    })

    await openAIAssistant(page)
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('推荐一个锅底')
    await page.keyboard.press('Enter')

    await expect(page.getByText(/API Key 无效，请检查配置|Invalid API Key/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/助理暂时无法响应，请重试|temporarily unavailable/i)).not.toBeVisible({ timeout: 3000 })
  })

  // ── REQ-004.3: 网络错误 ─────────────────────────────────────

  test('AI-DIRECT-004: 网络错误时显示「网络错误，请检查网络连接后重试」', async ({ page }) => {
    await page.route('**/api/chat*', async (route) => {
      await route.abort('failed')
    })

    await openAIAssistant(page)
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('推荐一个锅底')
    await page.keyboard.press('Enter')

    await expect(page.getByText(/网络错误，请检查网络连接后重试|Network error/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/助理暂时无法响应，请重试|temporarily unavailable/i)).not.toBeVisible({ timeout: 3000 })
  })

  // ── REQ-004.4: API 5xx 错误 ─────────────────────────────────

  test('AI-DIRECT-005: API 返回 500 时显示通用错误提示和重试按钮', async ({ page }) => {
    await page.route('**/api/chat*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    await openAIAssistant(page)
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('推荐一个锅底')
    await page.keyboard.press('Enter')

    // 验证显示通用错误提示
    await expect(page.getByText(/助理暂时无法响应，请重试|temporarily unavailable/i)).toBeVisible({ timeout: 10000 })
    // 验证重试按钮可见
    await expect(page.getByRole('button', { name: /重试|Retry/ })).toBeVisible({ timeout: 5000 })
  })

  // ── REQ-004.5: 错误后保留用户消息和重试入口 ──────────────────

  test('AI-DIRECT-006: 错误后保留用户消息，重试按钮可重新发送', async ({ page }) => {
    let requestCount = 0
    await page.route('**/api/chat*', async (route) => {
      requestCount++
      if (requestCount === 1) {
        // 第一次请求返回 500
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      } else {
        // 重试时返回成功
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: sseTextResponse('重试成功！推荐番茄锅底。'),
        })
      }
    })

    await openAIAssistant(page)
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('推荐一个锅底')
    await page.keyboard.press('Enter')

    // 验证错误提示出现
    await expect(page.getByText(/助理暂时无法响应，请重试|temporarily unavailable/i)).toBeVisible({ timeout: 10000 })
    // 验证用户消息保留
    await expect(page.getByText('推荐一个锅底')).toBeVisible()
    // 验证重试按钮可见
    const retryBtn = page.getByRole('button', { name: /重试|Retry/ })
    await expect(retryBtn).toBeVisible({ timeout: 5000 })
    // 点击重试
    await retryBtn.click()
    // 验证重试后显示成功回复
    await expect(page.getByText('重试成功！推荐番茄锅底。')).toBeVisible({ timeout: 10000 })
  })

  // ── REQ-002.4: Tool Call 加购 → 购物车更新 ─────────────────

  test('AI-DIRECT-007: AI 返回 add_to_cart tool call 时购物车更新', async ({ page }) => {
    let requestCount = 0
    await page.route('**/api/chat*', async (route) => {
      requestCount++
      if (requestCount === 1) {
        // 第一轮：返回 tool call (add_to_cart, product_id=p3)
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: sseFunctionCall('call_1', 'add_to_cart', { product_id: 'p3', quantity: 1 }),
        })
      } else {
        // 第二轮：返回确认文本
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: sseTextResponse('已加入购物车：琥珀嫩牛肉（下单人：姚乾）'),
        })
      }
    })

    await openAIAssistant(page)
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('来一份琥珀嫩牛肉')
    await page.keyboard.press('Enter')

    // 验证 AI 确认文本显示（证明多轮 tool call 流程完成）
    await expect(page.getByText(/已加入购物车/)).toBeVisible({ timeout: 15000 })
    // 验证购物车出现商品（侧边栏购物车显示商品数量）
    await expect(page.getByText(/共 1 份菜品|1 items/i)).toBeVisible({ timeout: 5000 })
  })

  // ── REQ-002.6: 售罄拦截 ─────────────────────────────────────

  test('AI-DIRECT-008: AI 返回已售罄菜品的 add_to_cart 时购物车不新增商品', async ({ page }) => {
    let requestCount = 0
    await page.route('**/api/chat*', async (route) => {
      requestCount++
      if (requestCount === 1) {
        // p8 是售罄菜品（initialState.soldOut = ['p8']）
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: sseFunctionCall('call_1', 'add_to_cart', { product_id: 'p8', quantity: 1 }),
        })
      } else {
        // tool handler 返回售罄信息，AI 告知用户售罄并推荐替代
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: sseTextResponse('抱歉，该菜品已售罄。要不要试试其他菜品？'),
        })
      }
    })

    await openAIAssistant(page)
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('来一份已售罄的菜')
    await page.keyboard.press('Enter')

    // 验证 AI 告知售罄
    await expect(page.getByText(/已售罄|sold out/i)).toBeVisible({ timeout: 15000 })
    // 验证购物车无新增商品（侧边栏不显示商品数量）
    await expect(page.getByText(/共 \d+ 份菜品|\d+ items/i)).not.toBeVisible({ timeout: 3000 })
  })
})
