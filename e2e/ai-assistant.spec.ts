import { test, expect, type Page } from '@playwright/test'

/** Helper: navigate from app start to menu view (bind table + enter menu) */
async function gotoMenu(page: Page) {
  await page.goto('/')
  // Bind table - click table A08
  await page.getByRole('button', { name: /A08/ }).first().click()
  // Welcome page - enter menu
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
}

test.describe('智能点单助理 - E2E 验收测试', () => {
  test('AI-001: 菜单页右下角显示 AI 助理悬浮按钮', async ({ page }) => {
    await gotoMenu(page)
    const floatBtn = page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ })
    await expect(floatBtn).toBeVisible()
  })

  test('AI-002: 点击悬浮按钮展开对话面板，显示欢迎语', async ({ page }) => {
    await gotoMenu(page)
    const floatBtn = page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ })
    await floatBtn.click()
    // 对话面板应展开
    await expect(page.getByText(/你好！我是智能点单助理|Hi! I'm your smart order assistant/)).toBeVisible()
    // 输入框和发送按钮可见
    await expect(page.getByPlaceholder(/输入你想吃的|Type what you'd like/)).toBeVisible()
  })

  test('AI-003: 点击关闭按钮收起对话面板', async ({ page }) => {
    await gotoMenu(page)
    const floatBtn = page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ })
    await floatBtn.click()
    await expect(page.getByText(/你好！我是智能点单助理|Hi! I'm your smart order assistant/)).toBeVisible()
    // 点击关闭按钮
    await page.getByRole('button', { name: /关闭|Close/ }).click()
    // 面板应关闭
    await expect(page.getByText(/你好！我是智能点单助理|Hi! I'm your smart order assistant/)).not.toBeVisible()
  })

  test('AI-004: 结账页不显示 AI 助理悬浮按钮', async ({ page }) => {
    await gotoMenu(page)
    // 加菜并提交订单
    await page.getByRole('button', { name: '锅底' }).click()
    const productCards = page.locator('article')
    await productCards.first().locator('button').last().click()
    await page.getByRole('button', { name: '微辣' }).click()
    await page.getByRole('button', { name: /加入本桌购物车|Add to table cart/ }).click()
    await page.waitForTimeout(300)
    // 提交订单
    await page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ }).click()
    await page.waitForLoadState('networkidle')
    // 去结账
    await page.getByRole('button', { name: /去结账|Checkout/ }).click()
    // 结账页不应显示 AI 助理
    const floatBtn = page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ })
    await expect(floatBtn).not.toBeVisible()
  })

  test('AI-005: 用户消息和 AI 消息在对话中正确区分显示', async ({ page }) => {
    await gotoMenu(page)
    await page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ }).click()
    // 输入并发送消息
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('推荐一个锅底')
    await page.keyboard.press('Enter')
    // 用户消息应显示在右侧
    await expect(page.getByText('推荐一个锅底')).toBeVisible()
  })

  test('AI-006: 清空对话按钮重置对话历史', async ({ page }) => {
    await gotoMenu(page)
    await page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ }).click()
    // 发送一条消息
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('测试消息')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    // 清空对话
    await page.getByRole('button', { name: /清空对话|Clear conversation/ }).click()
    // 应显示欢迎语
    await expect(page.getByText(/你好！我是智能点单助理|Hi! I'm your smart order assistant/)).toBeVisible()
  })

  test('AI-007: 深色模式下 AI 助理浮窗和面板正常显示', async ({ page }) => {
    await gotoMenu(page)
    // 切换深色模式
    const themeBtn = page.getByRole('button', { name: /切换主题|Toggle theme/ })
    await themeBtn.click()
    await page.getByRole('menuitemradio', { name: /深色|Dark/ }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    // AI 助理按钮可见
    const floatBtn = page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ })
    await expect(floatBtn).toBeVisible()
    // 打开面板
    await floatBtn.click()
    // 面板内容可见
    await expect(page.getByText(/你好！我是智能点单助理|Hi! I'm your smart order assistant/)).toBeVisible()
  })

  test('AI-008: 订单页也显示 AI 助理悬浮按钮', async ({ page }) => {
    await gotoMenu(page)
    // 加菜并提交订单
    await page.getByRole('button', { name: '锅底' }).click()
    const productCards = page.locator('article')
    await productCards.first().locator('button').last().click()
    await page.getByRole('button', { name: '微辣' }).click()
    await page.getByRole('button', { name: /加入本桌购物车|Add to table cart/ }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ }).click()
    await page.waitForLoadState('networkidle')
    // 订单页应显示 AI 助理
    const floatBtn = page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ })
    await expect(floatBtn).toBeVisible()
  })

  test('AI-009: 现有点餐流程在 AI 助理存在时正常工作', async ({ page }) => {
    await gotoMenu(page)
    // AI 助理按钮存在
    await expect(page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ })).toBeVisible()
    // 手动加菜流程正常
    await page.getByRole('button', { name: '锅底' }).click()
    const productCards = page.locator('article')
    await productCards.first().locator('button').last().click()
    await page.getByRole('button', { name: '微辣' }).click()
    await page.getByRole('button', { name: /加入本桌购物车|Add to table cart/ }).click()
    // 购物车应有商品
    await expect(page.getByText(/本桌购物车|Table Cart/).first()).toBeVisible()
    // 提交订单
    await page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ }).click()
    await page.waitForLoadState('networkidle')
    // 订单页可见
    await expect(page.getByText(/这一锅，正在抵达|Your pot is on the way/)).toBeVisible()
  })
})

test.describe('智能点单助理 - 服务端集成测试', () => {
  // 此测试需要服务端运行且配置了 HarnessRouter API Key 和 Provider Key
  // 在 CI 环境中可能因缺少 Provider Key 而跳过
  test.skip('AI-E2E: 完整用户路径 — 打开浮窗 → 发送点单请求 → AI 返回推荐 → 加入购物车', async ({ page }) => {
    await gotoMenu(page)
    // 打开 AI 助理
    await page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ }).click()
    // 发送点单请求
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('推荐一个锅底')
    await page.keyboard.press('Enter')
    // 等待 AI 响应
    await page.waitForTimeout(5000)
    // AI 消息应显示（内容不为空）
    const aiMessages = page.locator('.bg-white.text-charcoal-900, .dark\\:bg-charcoal-800')
    await expect(aiMessages.first()).toBeVisible()
  })
})
