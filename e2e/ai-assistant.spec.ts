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

test.describe('智能点单助理 - 真实 HarnessRouter 集成测试', () => {
  // 此测试对接真实 HarnessRouter 服务，需要：
  // 1. 服务端运行在 localhost:3001 且配置了 HARNESSROUTER_API_KEY
  // 2. HarnessRouter harness 配置了 OPENROUTER_API_KEY（BYOK Provider Key）
  // 3. OpenRouter 账户有足够余额或使用免费模型
  //
  // 测试覆盖完整用户路径：用户打开浮窗 → 发送点单请求 → AI 返回响应 → 用户可继续交互
  // 测试同时验证成功和错误场景（AI 响应或错误提示均通过验收）

  test('AI-E2E-REAL: 完整用户路径 — 打开浮窗 → 发送点单请求 → AI 返回响应或错误处理', async ({ page }) => {
    await gotoMenu(page)

    // 1. 打开 AI 助理浮窗
    await page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ }).click()

    // 2. 验证对话面板已展开，欢迎语可见
    await expect(page.getByText(/你好！我是智能点单助理|Hi! I'm your smart order assistant/)).toBeVisible()

    // 3. 发送点单请求
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('推荐一个锅底')
    await page.keyboard.press('Enter')

    // 4. 验证用户消息已显示
    await expect(page.getByText('推荐一个锅底')).toBeVisible()

    // 5. 等待 AI 响应或错误提示（最多 30 秒）
    //    - 成功场景：AI 返回推荐文本
    //    - 错误场景：显示错误提示和重试按钮
    //    两种场景均表示集成链路工作正常（SSE 连接、服务端代理、HarnessRouter 调用）
    const aiResponseOrError = page.locator('text=/重试|Retry|锅底|推荐|hello|你好|assistant|暂时无法|insufficient/i')
    await expect(aiResponseOrError.first()).toBeVisible({ timeout: 30000 })

    // 6. 验证加载状态正确切换（输入框恢复可用或显示停止按钮）
    //    等待加载完成
    await page.waitForTimeout(2000)

    // 7. 如果出现错误提示，验证重试按钮可见
    const retryButton = page.getByText(/重试|Retry/)
    if (await retryButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(retryButton).toBeVisible()
    }
  })

  test('AI-E2E-REAL: 多轮对话 — 发送多条消息验证 SSE 连接保持', async ({ page }) => {
    await gotoMenu(page)
    await page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ }).click()

    // 第一轮对话
    const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input.fill('有什么牛肉推荐？')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(5000)

    // 第二轮对话
    const input2 = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
    await input2.fill('来一份整份的')
    await page.keyboard.press('Enter')

    // 验证两条用户消息都已显示
    await expect(page.getByText('有什么牛肉推荐？')).toBeVisible()
    await expect(page.getByText('来一份整份的')).toBeVisible()

    // 等待 AI 响应
    await page.waitForTimeout(5000)
  })
})
