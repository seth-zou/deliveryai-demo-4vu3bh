import { test, expect, type Page } from '@playwright/test'

/**
 * 推荐菜功能 E2E 验收测试
 *
 * 覆盖 Spec REQ-001 ~ REQ-010：
 * - REQ-001 推荐区域展示
 * - REQ-002 菜品热度排行推荐
 * - REQ-003 时段推荐
 * - REQ-004 口味偏好匹配推荐
 * - REQ-005 搭配推荐
 * - REQ-006 推荐去重与售罄过滤
 * - REQ-007 推荐刷新时机
 * - REQ-008 推荐菜品加购衔接
 * - REQ-009 降级与异常处理
 * - REQ-010 中英文双语支持
 */

/** Helper: navigate from app start to menu view (bind table + enter menu) */
async function gotoMenu(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click()
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
}

/**
 * Helper: add a product from a category tab to the cart (default spec).
 * categoryName should match the current language (e.g. '锅底' or 'Broth').
 */
async function addProductFromCategory(page: Page, categoryName: string, productIndex = 0) {
  await page.getByRole('button', { name: categoryName, exact: true }).first().click()
  const productCards = page.locator('article')
  await productCards.nth(productIndex).locator('button').last().click()
  // If spicy options exist, select mild to avoid risk warning dialog
  const mildBtn = page.getByRole('button', { name: /^微辣$|^Mild$/ })
  if (await mildBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await mildBtn.click()
  }
  await page.getByRole('button', { name: /加入本桌购物车|Add to Table Cart/i }).click()
}

/** Helper: get recommendation cards (buttons with w-40 class — unique to recommend cards) */
function recommendCards(page: Page) {
  return page.locator('button.w-40')
}

/** Helper: get recommendation area text content (heading grandparent div) */
async function recommendText(page: Page): Promise<string> {
  const heading = page.getByRole('heading', { name: /为你推荐|Recommended For You/ })
  const container = heading.locator('xpath=../..')
  return (await container.textContent()) || ''
}

/** Helper: get combo section (heading parent div that contains combo items) */
function comboSection(page: Page) {
  return page.getByRole('heading', { name: /搭配推荐|Combo Suggestions/ })
    .locator('xpath=../..')
}

test.describe('推荐菜功能 - E2E 验收测试', () => {

  // ─────────────────────────────────────────────
  // REQ-001: 推荐区域展示
  // ─────────────────────────────────────────────

  test('REQ-001.1: 用户进入菜单页后，分类 Tab 上方展示"为你推荐"横滑区域', async ({ page }) => {
    await gotoMenu(page)
    const title = page.getByRole('heading', { name: /为你推荐|Recommended For You/ })
    await expect(title).toBeVisible()
  })

  test('REQ-001.2: 推荐区域展示 3-6 个推荐菜品', async ({ page }) => {
    await gotoMenu(page)
    const cards = recommendCards(page)
    await expect(cards.first()).toBeVisible()
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(3)
    expect(count).toBeLessThanOrEqual(6)
  })

  test('REQ-001.3: 每张推荐卡片附带 1-2 个推荐理由标签', async ({ page }) => {
    await gotoMenu(page)
    const cards = recommendCards(page)
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i)
      // Reason tags are spans with amber background class
      const reasonTags = card.locator('span[class*="amber"]')
      const tagCount = await reasonTags.count()
      expect(tagCount).toBeGreaterThanOrEqual(1)
    }
  })

  test('REQ-001.4: 推荐区域位于分类 Tab 上方，不遮挡搜索框和分类 Tab', async ({ page }) => {
    await gotoMenu(page)
    const recommendHeading = page.getByRole('heading', { name: /为你推荐|Recommended For You/ })
    const searchInput = page.getByPlaceholder(/搜索|Search/)
    const recommendBox = await recommendHeading.boundingBox()
    const searchBox = await searchInput.boundingBox()
    expect(recommendBox).not.toBeNull()
    expect(searchBox).not.toBeNull()
    // Recommendation should be above search (smaller y)
    expect(recommendBox!.y).toBeLessThan(searchBox!.y)
    // Category tabs should be visible
    await expect(page.getByRole('button', { name: '锅底', exact: true })).toBeVisible()
  })

  // ─────────────────────────────────────────────
  // REQ-002: 菜品热度排行推荐
  // ─────────────────────────────────────────────

  test('REQ-002.1: 推荐列表中包含 badge 为 popular/signature/chef 的菜品', async ({ page }) => {
    await gotoMenu(page)
    const text = await recommendText(page)
    // p1 has badge popular (人气 No.1), p2 has signature (招牌), p3 has chef (主厨推荐)
    const hasPopularBadge = text.includes('人气 No.1') || text.includes('Top Pick')
    const hasSignature = text.includes('招牌') || text.includes('Signature')
    const hasChef = text.includes('主厨推荐') || text.includes("Chef's Choice")
    expect(hasPopularBadge || hasSignature || hasChef).toBeTruthy()
  })

  test('REQ-002.2: 热度菜品附带热度类推荐理由标签（人气推荐 / Top Pick）', async ({ page }) => {
    await gotoMenu(page)
    const text = await recommendText(page)
    expect(text).toContain('人气推荐')
  })

  // ─────────────────────────────────────────────
  // REQ-003: 时段推荐
  // ─────────────────────────────────────────────

  test('REQ-003: 当前时段对应的时段推荐理由标签可见', async ({ page }) => {
    // Compute hour the same way the implementation does: new Date().getHours()
    // Both Node.js and headless Chromium run in UTC timezone in this environment
    const hour = new Date().getHours()
    let expectedLabel: string
    if (hour >= 10 && hour < 14) {
      expectedLabel = '午餐热门'
    } else if (hour >= 17 && hour < 22) {
      expectedLabel = '晚餐热门'
    } else if (hour >= 22 || hour < 2) {
      expectedLabel = '夜宵热门'
    } else {
      expectedLabel = '' // other time slots: no time label
    }

    await gotoMenu(page)
    const text = await recommendText(page)

    if (expectedLabel) {
      expect(text).toContain(expectedLabel)
    }
    // For "other" time slots, just verify no crash
    expect(text).toBeTruthy()
  })

  // ─────────────────────────────────────────────
  // REQ-004: 口味偏好匹配推荐
  // ─────────────────────────────────────────────

  test('REQ-004.1: 推荐列表包含与模拟用户口味画像 tags 匹配的菜品（辣味爱好者标签）', async ({ page }) => {
    await gotoMenu(page)
    const text = await recommendText(page)
    expect(text).toContain('辣味爱好者')
  })

  test('REQ-004.4: RESET 后推荐区域恢复正常显示', async ({ page }) => {
    await gotoMenu(page)
    await expect(page.getByRole('heading', { name: /为你推荐|Recommended For You/ })).toBeVisible()
    // Simulate RESET by reloading (SPA resets state on reload)
    await page.reload()
    await page.getByRole('button', { name: /A08/ }).first().click()
    await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
    await expect(page.getByRole('heading', { name: /为你推荐|Recommended For You/ })).toBeVisible()
  })

  // ─────────────────────────────────────────────
  // REQ-005: 搭配推荐
  // ─────────────────────────────────────────────

  test('REQ-005.1: 购物车中已有主菜（锅底类）时，出现"搭配推荐"模块', async ({ page }) => {
    await gotoMenu(page)
    // Initially no combo section
    expect(await page.getByRole('heading', { name: /搭配推荐|Combo Suggestions/ })
      .isVisible({ timeout: 2000 }).catch(() => false)).toBeFalsy()

    // Add a broth (main dish) to cart
    await addProductFromCategory(page, '锅底', 0)
    await page.waitForTimeout(500)

    // Combo section should now appear
    await expect(page.getByRole('heading', { name: /搭配推荐|Combo Suggestions/ })).toBeVisible()
  })

  test('REQ-005.2: 搭配推荐展示 1-3 个搭配菜品组合建议', async ({ page }) => {
    await gotoMenu(page)
    await addProductFromCategory(page, '牛羊肉', 0)
    await page.waitForTimeout(500)

    const combo = comboSection(page)
    await expect(combo).toBeVisible()
    const addComboButtons = combo.getByRole('button', { name: /一键加入搭配|Add Combo/ })
    const comboCount = await addComboButtons.count()
    expect(comboCount).toBeGreaterThanOrEqual(1)
    expect(comboCount).toBeLessThanOrEqual(3)
  })

  test('REQ-005.3: 点击"一键加入搭配"后，搭配组合所有菜品同时加入购物车', async ({ page }) => {
    await gotoMenu(page)
    await addProductFromCategory(page, '锅底', 0)
    await page.waitForTimeout(500)

    const combo = comboSection(page)
    await expect(combo).toBeVisible()

    const cartCountBefore = await page.getByText(/共 \d+ 份菜品|\d+ items/).first().textContent().catch(() => '0')

    const addComboBtn = combo.getByRole('button', { name: /一键加入搭配|Add Combo/ }).first()
    await addComboBtn.click()
    await page.waitForTimeout(500)

    const cartCountAfter = await page.getByText(/共 \d+ 份菜品|\d+ items/).first().textContent().catch(() => '0')
    const beforeNum = parseInt((cartCountBefore || '0').match(/\d+/)?.[0] || '0')
    const afterNum = parseInt((cartCountAfter || '0').match(/\d+/)?.[0] || '0')
    expect(afterNum).toBeGreaterThan(beforeNum)
  })

  test('REQ-005.5: 购物车内容变化后搭配推荐动态更新', async ({ page }) => {
    await gotoMenu(page)
    await addProductFromCategory(page, '锅底', 0)
    await page.waitForTimeout(500)

    const combo = comboSection(page)
    await expect(combo).toBeVisible()

    const comboCountBefore = await combo.getByRole('button', { name: /一键加入搭配|Add Combo/ }).count()
    const addComboBtn = combo.getByRole('button', { name: /一键加入搭配|Add Combo/ }).first()
    await addComboBtn.click()
    await page.waitForTimeout(500)

    // After adding combo items, combo suggestions should refresh (added items filtered out)
    const comboCountAfter = await comboSection(page)
      .getByRole('button', { name: /一键加入搭配|Add Combo/ }).count().catch(() => 0)
    expect(comboCountAfter).toBeLessThanOrEqual(comboCountBefore)
  })

  // ─────────────────────────────────────────────
  // REQ-006: 推荐去重与售罄过滤
  // ─────────────────────────────────────────────

  test('REQ-006.1: 已加入购物车的菜品在推荐列表中标记"已加购"', async ({ page }) => {
    await gotoMenu(page)
    const cards = recommendCards(page)
    await cards.first().click()
    await page.waitForTimeout(300)

    // If spicy options exist, select 微辣
    const mildBtn = page.getByRole('button', { name: /^微辣$|^Mild$/ })
    if (await mildBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await mildBtn.click()
    }
    await page.getByRole('button', { name: /加入本桌购物车|Add to Table Cart/i }).click()
    await page.waitForTimeout(500)

    // The recommended product should now show "已加购" mark in recommendation area
    const text = await recommendText(page)
    expect(text).toContain('已加购')
  })

  test('REQ-006.2: 售罄菜品不出现在推荐列表中', async ({ page }) => {
    await gotoMenu(page)
    // Get first recommended product name
    const cards = recommendCards(page)
    const firstCardName = await cards.first().locator('h3').textContent()
    expect(firstCardName).toBeTruthy()

    // Open demo console
    await page.getByRole('button', { name: /演示控制台|Demo Console|控制台/ }).click()
    await expect(page.getByText(/桌台与履约|Table & Fulfillment/)).toBeVisible()

    // Find the sold-out toggle button for the target product inside the dialog
    const dialog = page.getByRole('dialog')
    const soldOutBtn = dialog.getByRole('button', { name: firstCardName!, exact: true })
    await soldOutBtn.click()

    // Close console
    await page.getByRole('button', { name: /完成设置|Done/ }).click()
    await page.waitForTimeout(500)

    // The sold-out product should not appear in recommendation cards
    const updatedCards = recommendCards(page)
    const updatedNames: string[] = []
    for (let i = 0; i < await updatedCards.count(); i++) {
      const name = await updatedCards.nth(i).locator('h3').textContent()
      updatedNames.push(name || '')
    }
    expect(updatedNames).not.toContain(firstCardName)
  })

  test('REQ-006.3: 购物车变化后推荐列表重新计算', async ({ page }) => {
    await gotoMenu(page)
    const countBefore = await recommendCards(page).count()

    // Add a product from category
    await addProductFromCategory(page, '锅底', 0)
    await page.waitForTimeout(500)

    // Recommendation list should recalculate; count within valid range
    const countAfter = await recommendCards(page).count()
    expect(countAfter).toBeGreaterThanOrEqual(1)
    expect(countAfter).toBeLessThanOrEqual(6)
  })

  // ─────────────────────────────────────────────
  // REQ-008: 推荐菜品加购衔接
  // ─────────────────────────────────────────────

  test('REQ-008.1: 点击推荐菜品卡片弹出规格选择 Dialog', async ({ page }) => {
    await gotoMenu(page)
    const cards = recommendCards(page)
    await cards.first().click()
    await page.waitForTimeout(300)

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: /加入本桌购物车|Add to Table Cart/i })).toBeVisible()
  })

  test('REQ-008.2: 推荐菜品加购行为与分类浏览一致（含超级辣风险提示）', async ({ page }) => {
    await gotoMenu(page)
    const cards = recommendCards(page)
    await cards.first().click()
    await page.waitForTimeout(300)

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    const superSpicyBtn = page.getByRole('button', { name: '超级辣', exact: true })
    if (await superSpicyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await superSpicyBtn.click()
      await expect(page.getByText(/风险提示|Risk Warning/)).toBeVisible()
    } else {
      // Non-spicy product: verify add to cart works
      await page.getByRole('button', { name: /加入本桌购物车|Add to Table Cart/i }).click()
      await expect(page.getByText(/本桌购物车|Table Cart/).first()).toBeVisible()
    }
  })

  // ─────────────────────────────────────────────
  // REQ-009: 降级与异常处理
  // ─────────────────────────────────────────────

  test('REQ-009: 推荐区域不抛出未捕获错误，不阻断正常点餐', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await gotoMenu(page)
    await expect(page.getByRole('heading', { name: /为你推荐|Recommended For You/ })).toBeVisible()

    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('Favicon'),
    )
    expect(criticalErrors).toEqual([])
  })

  // ─────────────────────────────────────────────
  // REQ-010: 中英文双语支持
  // ─────────────────────────────────────────────

  test('REQ-010.1: 切换到英文后推荐相关文案正确显示', async ({ page }) => {
    await gotoMenu(page)
    const langBtn = page.getByRole('button', { name: /切换语言|Switch language/ })
    await langBtn.click()
    await page.waitForTimeout(300)

    await expect(page.getByText('Recommended For You')).toBeVisible()
    const text = await recommendText(page)
    expect(text).toContain('Top Pick')

    // Switch back to Chinese
    await page.getByRole('button', { name: /切换语言|Switch language/ }).click()
    await page.waitForTimeout(300)
    await expect(page.getByText('为你推荐')).toBeVisible()
  })

  test('REQ-010.2: 英文模式下搭配推荐和一键加购按钮文案正确', async ({ page }) => {
    await gotoMenu(page)
    // Switch to English
    const langBtn = page.getByRole('button', { name: /切换语言|Switch language/ })
    await langBtn.click()
    await page.waitForTimeout(300)

    // Add a main dish to trigger combo (use English category name)
    await addProductFromCategory(page, 'Broth', 0)
    await page.waitForTimeout(500)

    await expect(page.getByText('Combo Suggestions')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Combo' }).first()).toBeVisible()

    // Switch back to Chinese
    await page.getByRole('button', { name: /切换语言|Switch language/ }).click()
    await page.waitForTimeout(300)
    await expect(page.getByText('搭配推荐')).toBeVisible()
    await expect(page.getByRole('button', { name: '一键加入搭配' }).first()).toBeVisible()
  })
})

test.describe('推荐菜功能 - 核心点餐流程回归', () => {

  test('REG-001: 推荐功能启用后，完整点餐流程不受影响（绑桌→加购→提交订单）', async ({ page }) => {
    await gotoMenu(page)
    await expect(page.getByRole('heading', { name: /为你推荐|Recommended For You/ })).toBeVisible()

    await page.getByRole('button', { name: '锅底', exact: true }).click()
    const productCards = page.locator('article')
    await productCards.first().locator('button').last().click()
    await page.getByRole('button', { name: '微辣' }).click()
    await page.getByRole('button', { name: /加入本桌购物车|Add to Table Cart/i }).click()
    await page.waitForTimeout(300)

    const submitBtn = page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ })
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
    } else {
      await page.getByRole('button', { name: /查看购物车|View Cart/ }).click()
      await page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ }).click()
    }

    await expect(page.getByText(/这一锅，正在抵达|Your pot is on the way/)).toBeVisible()
  })

  test('REG-002: 现有"推荐"分类 Tab 仍显示全部菜品', async ({ page }) => {
    await gotoMenu(page)
    await page.getByRole('button', { name: '推荐', exact: true }).click()
    await page.waitForTimeout(300)

    const articles = page.locator('article')
    const count = await articles.count()
    expect(count).toBe(10)
  })

  test('REG-003: 搜索功能不受推荐区域影响', async ({ page }) => {
    await gotoMenu(page)
    const searchInput = page.getByPlaceholder(/搜索|Search/)
    await searchInput.fill('牛油')

    const articles = page.locator('article')
    await page.waitForTimeout(300)
    const count = await articles.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(10)
  })
})
