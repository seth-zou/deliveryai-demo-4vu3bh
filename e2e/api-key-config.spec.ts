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

/** Helper: get the API Key config entry button */
function configBtn(page: Page) {
  return page.getByRole('button', { name: /API Key 配置|API Key Config/ })
}

/** Helper: get the API Key input field inside the config popover */
function apiKeyInput(page: Page) {
  return page.getByPlaceholder(/输入 HARNESSROUTER_API_KEY|Enter HARNESSROUTER_API_KEY/)
}

/** Helper: get the save button inside the config popover */
function saveBtn(page: Page) {
  return page.getByRole('button', { name: /^保存$|^Save$/ })
}

/** Helper: get the clear button inside the config popover */
function clearBtn(page: Page) {
  return page.getByRole('button', { name: /^清除$|^Clear$/ })
}

test.describe('HARNESSROUTER_API_KEY 临时配置入口 - E2E 验收测试', () => {

  // ── REQ-001: 弹窗标题栏右上角 API Key 配置入口 ────────────

  test('API-KEY-001: 弹窗右上角显示 API Key 配置入口图标', async ({ page }) => {
    await openAIAssistant(page)
    await expect(configBtn(page)).toBeVisible()
  })

  test('API-KEY-002: 点击配置入口弹出配置浮层（含输入框、保存、清除按钮）', async ({ page }) => {
    await openAIAssistant(page)
    await configBtn(page).click()
    // 浮层应包含密码输入框
    await expect(apiKeyInput(page)).toBeVisible()
    // 保存按钮可见
    await expect(saveBtn(page)).toBeVisible()
    // 清除按钮可见
    await expect(clearBtn(page)).toBeVisible()
  })

  test('API-KEY-003: 点击外部区域或按 ESC 关闭配置浮层', async ({ page }) => {
    await openAIAssistant(page)
    await configBtn(page).click()
    await expect(apiKeyInput(page)).toBeVisible()
    // 按 ESC 关闭浮层
    await page.keyboard.press('Escape')
    await expect(apiKeyInput(page)).not.toBeVisible()
  })

  test('API-KEY-004: 点击浮层外部区域关闭浮层', async ({ page }) => {
    await openAIAssistant(page)
    await configBtn(page).click()
    await expect(apiKeyInput(page)).toBeVisible()
    // 点击标题栏左侧标题区域（浮层外部）
    await page.getByText(/智能点单助理|Smart Order Assistant/).first().click()
    await expect(apiKeyInput(page)).not.toBeVisible()
  })

  // ── REQ-002: API Key 输入、保存与持久化 ──────────────────

  test('API-KEY-005: 输入 API Key 并保存 → 存入 localStorage，浮层关闭，图标显示已配置状态', async ({ page }) => {
    await openAIAssistant(page)
    await configBtn(page).click()
    await apiKeyInput(page).fill('test-api-key-12345')
    await saveBtn(page).click()
    // 浮层应关闭
    await expect(apiKeyInput(page)).not.toBeVisible()
    // localStorage 中应存储 Key
    const storedKey = await page.evaluate(() => localStorage.getItem('harnessrouter_api_key'))
    expect(storedKey).toBe('test-api-key-12345')
    // 配置入口图标应显示已配置状态（title 属性变更）
    await expect(configBtn(page)).toHaveAttribute('title', /API Key 已配置|API Key configured/)
  })

  test('API-KEY-006: 空输入时保存按钮禁用，无法保存', async ({ page }) => {
    await openAIAssistant(page)
    await configBtn(page).click()
    // 空输入时保存按钮应禁用
    await expect(saveBtn(page)).toBeDisabled()
    // 输入空格后保存按钮仍应禁用
    await apiKeyInput(page).fill('   ')
    await expect(saveBtn(page)).toBeDisabled()
    // 输入内容后保存按钮启用
    await apiKeyInput(page).fill('valid-key')
    await expect(saveBtn(page)).toBeEnabled()
  })

  test('API-KEY-007: 眼睛图标切换明文/密文显示', async ({ page }) => {
    await openAIAssistant(page)
    await configBtn(page).click()
    await apiKeyInput(page).fill('secret-key-value')
    // 默认密码类型
    await expect(apiKeyInput(page)).toHaveAttribute('type', 'password')
    // 点击眼睛图标切换为明文
    await page.getByRole('button', { name: 'Show' }).click()
    await expect(apiKeyInput(page)).toHaveAttribute('type', 'text')
    // 再次点击切换回密文
    await page.getByRole('button', { name: 'Hide' }).click()
    await expect(apiKeyInput(page)).toHaveAttribute('type', 'password')
  })

  test('API-KEY-008: 已保存的 Key 在重新打开浮层时预填', async ({ page }) => {
    // 先通过 UI 保存 Key
    await openAIAssistant(page)
    await configBtn(page).click()
    await apiKeyInput(page).fill('persisted-key-67890')
    await saveBtn(page).click()
    // 重新打开浮层
    await configBtn(page).click()
    // 输入框应预填已保存的 Key
    await expect(apiKeyInput(page)).toHaveValue('persisted-key-67890')
  })

  // ── REQ-003: API Key 清除 ───────────────────────────────

  test('API-KEY-009: 点击清除按钮删除 localStorage Key，图标恢复未配置状态', async ({ page }) => {
    // 先保存一个 Key
    await openAIAssistant(page)
    await configBtn(page).click()
    await apiKeyInput(page).fill('temp-key-to-clear')
    await saveBtn(page).click()
    // 确认已保存
    const storedKey = await page.evaluate(() => localStorage.getItem('harnessrouter_api_key'))
    expect(storedKey).toBe('temp-key-to-clear')
    // 再次打开浮层并清除
    await configBtn(page).click()
    await clearBtn(page).click()
    // localStorage 中 Key 应被删除
    const clearedKey = await page.evaluate(() => localStorage.getItem('harnessrouter_api_key'))
    expect(clearedKey).toBeNull()
    // 图标应恢复未配置状态
    await expect(configBtn(page)).toHaveAttribute('title', /未配置 API Key|API Key not configured/)
  })

  // ── 默认状态 ─────────────────────────────────────────────

  test('API-KEY-010: 默认未配置状态（图标显示未配置）', async ({ page }) => {
    await openAIAssistant(page)
    await expect(configBtn(page)).toHaveAttribute('title', /未配置 API Key|API Key not configured/)
  })

  // ── REQ-004: 前端 Key 传递与服务端 fallback 逻辑 ─────────

  test('API-KEY-011: 配置 Key 后发送消息，请求 Header 包含 Authorization Bearer Key', async ({ page }) => {
    // Mock HarnessRouter API 接口，捕获请求 Header
    let capturedHeaders: Record<string, string> = {}
    await page.route('**/api/chat*', async (route) => {
      capturedHeaders = route.request().headers()
      // 返回最小 SSE 响应（response.completed 事件）
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"response.completed","response":{"id":"resp_mock_test"}}\n\n',
      })
    })

    await openAIAssistant(page)
    // 先保存 API Key
    await configBtn(page).click()
    await apiKeyInput(page).fill('header-test-key-abc')
    await saveBtn(page).click()
    // 发送消息
    const msgInput = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await msgInput.fill('推荐一个锅底')
    await msgInput.press('Enter')
    // 等待请求发出并捕获 Header，验证 Authorization Bearer 头
    await expect.poll(() => capturedHeaders['x-harnessrouter-api-key'] || '').toBe('header-test-key-abc')
  })

  test('API-KEY-012: 未配置 Key 时发送消息，显示配置提示且不发起 API 请求', async ({ page }) => {
    let requestMade = false
    await page.route('**/api/chat*', async (route) => {
      requestMade = true
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: {"type":"response.completed","response":{"id":"resp_mock_test"}}\n\n',
      })
    })

    await openAIAssistant(page)
    // 不配置 Key，直接发送消息
    const msgInput = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await msgInput.fill('推荐一个锅底')
    await msgInput.press('Enter')
    // 应显示配置提示而非笼统错误
    await expect(page.getByText(/请先配置 HARNESSROUTER_API_KEY|Please configure HARNESSROUTER_API_KEY first/)).toBeVisible({ timeout: 5000 })
    // 不应发起 API 请求
    expect(requestMade).toBe(false)
  })
})
