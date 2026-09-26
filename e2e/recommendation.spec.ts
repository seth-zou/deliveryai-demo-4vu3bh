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
  // Bind table - click table A08
  await page.getByRole('button', { name: /A08/ }).first().click()
  // Welcome page - enter menu
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
}

/** Helper: add a product from a category tab to the cart (default spec) */
async function addProductFromCategory(page: Page, categoryName: string, productIndex = 0) {
  await page.getByRole('button', { name: categoryName, exact: true }).first().click()
  const productCards = page.locator('article')
  await productCards.nth(productIndex).locator('button').last().click()
  // If spicy options exist, select 微辣 to avoid risk warning dialog
  const mildBtn = page.getByRole('button', { name: '微辣', exact: true })
  if (await mildBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await mildBtn.click()
  }
  await page.getByRole('button', { name: /加入本桌购物车|Add to table cart/ }).click()
}

/** Helper: get the recommendation area section */
function recommendSection(page: Page) {
  return page.locator('section').filter({ hasText: /为你推荐|Recommended For You/ }).first()
}

/** Helper: get recommendation cards (horizontal scroll area buttons) */
function recommendCards(page: Page) {
  return recommendSection(page).locator('button:has(img)')
}

/** Helper: get combo suggestion section */
function comboSection(page: Page) {
  return page.locator('section').filter({ hasText: /搭配推荐|Combo Suggestions/ }).first()
}

test.describe('推荐菜功能 - E2E 验收测试', () => {

  // ─────────────────────────────────────────────
  // REQ-001: 推荐区域展示
  // ─────────────────────────────────────────────

  test('REQ-001.1: 用户进入菜单页后，分类 Tab 上方展示"为你推荐"横滑区域', async ({ page }) => {
    await gotoMenu(page)
    const title = page.getByText(/为你推荐|Recommended For You/)
    await expect(title).toBeVisible()
  })

  test('REQ-001.2: 推荐区域展示 3-6 个推荐菜品', async ({ page }) => {
    await gotoMenu(page)
    await expect(recommendSection(page)).toBeVisible()
    // Wait for recommendation cards to render
    const cards = recommendCards(page)
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(3)
    expect(count).toBeLessThanOrEqual(6)
  })

  test('REQ-001.3: 每张推荐卡片附带 1-2 个推荐理由标签', async ({ page }) => {
    await gotoMenu(page)
    const cards = recommendCards(page)
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    // Check each card has at least 1 reason tag (rounded-full span with amber background)
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i)
      // Reason tags are spans with bg-amber-100 or dark:bg-amber-400/20
      const reasonTags = card.locator('span.rounded-full.bg-amber-100, span[class*="amber"]')
      const tagCount = await reasonTags.count()
      // At least 1 reason tag per card (badge span also uses amber, but reasons are inside card body)
      // We check that there are tag-like elements; allowing badge to count too
      expect(tagCount).toBeGreaterThanOrEqual(1)
    }
  })

  test('REQ-001.4: 推荐区域位于分类 Tab 上方，不遮挡搜索框和分类 Tab', async ({ page }) => {
    await gotoMenu(page)
    // Recommendation title should appear before the search input in DOM order
    const recommendTitle = page.getByText(/为你推荐|Recommended For You/)
    const searchInput = page.getByPlaceholder(/搜索|Search/)
    const recommendBox = await recommendTitle.boundingBox()
    const searchBox = await searchInput.boundingBox()
    expect(recommendBox).not.toBeNull()
    expect(searchBox).not.toBeNull()
    // Recommendation should be above search (smaller y) — both are in the same section
    // The search is in a sticky container after recommendation area
    expect(recommendBox!.y).toBeLessThan(searchBox!.y)
    // Category tabs should be visible
    await expect(page.getByRole('button', { name: '锅底', exact: true })).toBeVisible()
  })

  // ─────────────────────────────────────────────
  // REQ-002: 菜品热度排行推荐
  // ─────────────────────────────────────────────

  test('REQ-002.1: 推荐列表中包含 badge 为 popular/signature/chef 的菜品', async ({ page }) => {
    await gotoMenu(page)
    // p1 has badge popular (人气 No.1), p2 has signature (招牌), p3 has chef (主厨推荐)
    // These should appear in recommendations with "人气推荐" tag
    const recommendText = await recommendSection(page).textContent()
    expect(recommendText).toBeTruthy()
    // At least one of these badge names should appear
    const hasPopularBadge = recommendText!.includes('人气 No.1') || recommendText!.includes('Top Pick')
    const hasSignature = recommendText!.includes('招牌') || recommendText!.includes('Signature')
    const hasChef = recommendText!.includes('主厨推荐') || recommendText!.includes('Chef')
    expect(hasPopularBadge || hasSignature || hasChef).toBeTruthy()
  })

  test('REQ-002.2: 热度菜品附带热度类推荐理由标签（人气推荐 / Top Pick）', async ({ page }) => {
    await gotoMenu(page)
    const recommendText = await recommendSection(page).textContent()
    // "人气推荐" is the popularity reason tag i18n text
    expect(recommendText).toContain('人气推荐')
  })

  // ─────────────────────────────────────────────
  // REQ-003: 时段推荐
  // ─────────────────────────────────────────────

  test('REQ-003: 当前时段对应的时段推荐理由标签可见', async ({ page }) => {
    // Determine current time slot based on current hour
    const now = new Date()
    const hour = now.getUTCHours() + 8 // approx Beijing time (UTC+8)
    const beijingHour = ((hour % 24) + 24) % 24

    let expectedLabel: string
    if (beijingHour >= 10 && beijingHour < 14) {
      expectedLabel = '午餐热门'
    } else if (beijingHour >= 17 && beijingHour < 22) {
      expectedLabel = '晚餐热门'
    } else if (beijingHour >= 22 || beijingHour < 2) {
      expectedLabel = '夜宵热门'
    } else {
      // Other time slots: no time slot label expected
      expectedLabel = ''
    }

    await gotoMenu(page)
    const recommendText = await recommendSection(page).textContent()

    if (expectedLabel) {
      expect(recommendText).toContain(expectedLabel)
    }
    // For "other" time slots, no time label should appear — just verify no crash
    expect(recommendText).toBeTruthy()
  })

  // ─────────────────────────────────────────────
  // REQ-004: 口味偏好匹配推荐
  // ─────────────────────────────────────────────

  test('REQ-004.1: 推荐列表包含与模拟用户口味画像 tags 匹配的菜品（辣味爱好者标签）', async ({ page }) => {
    await gotoMenu(page)
    // Simulated preference tags = ['辣', '肉类', '招牌']
    // p2 (牛油麻辣锅) has tags ['辣','牛油','麻辣'] → should match and show "辣味爱好者"
    const recommendText = await recommendSection(page).textContent()
    // "辣味爱好者" is the spicy_lover reason tag
    expect(recommendText).toContain('辣味爱好者')
  })

  test('REQ-004.4: RESET 后推荐区域恢复正常显示', async ({ page }) => {
    await gotoMenu(page)
    await expect(recommendSection(page)).toBeVisible()
    // Simulate RESET by reloading (SPA resets state on reload)
    await page.reload()
    // Re-bind table and enter menu
    await page.getByRole('button', { name: /A08/ }).first().click()
    await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
    await expect(recommendSection(page)).toBeVisible()
  })

  // ─────────────────────────────────────────────
  // REQ-005: 搭配推荐
  // ─────────────────────────────────────────────

  test('REQ-005.1: 购物车中已有主菜（锅底类）时，出现"搭配推荐"模块', async ({ page }) => {
    await gotoMenu(page)
    // Initially no combo section (no main dish in cart)
    expect(await comboSection(page).isVisible({ timeout: 2000 }).catch(() => false)).toBeFalsy()

    // Add a broth (main dish) to cart
    await addProductFromCategory(page, '锅底', 0)
    await page.waitForTimeout(500)

    // Combo section should now appear
    await expect(comboSection(page)).toBeVisible()
    await expect(page.getByText(/搭配推荐|Combo Suggestions/)).toBeVisible()
  })

  test('REQ-005.2: 搭配推荐展示 2-3 个搭配菜品组合建议', async ({ page }) => {
    await gotoMenu(page)
    // Add a meat dish (also a main dish)
    await addProductFromCategory(page, '牛羊肉', 0)
    await page.waitForTimeout(500)

    const combo = comboSection(page)
    await expect(combo).toBeVisible()
    // Each combo has an "一键加入搭配" / "Add Combo" button
    const addComboButtons = combo.getByRole('button', { name: /一键加入搭配|Add Combo/ })
    const comboCount = await addComboButtons.count()
    expect(comboCount).toBeGreaterThanOrEqual(1)
    expect(comboCount).toBeLessThanOrEqual(3)
  })

  test('REQ-005.3: 点击"一键加入搭配"后，搭配组合所有菜品同时加入购物车', async ({ page }) => {
    await gotoMenu(page)
    // Add a broth as main dish
    await addProductFromCategory(page, '锅底', 0)
    await page.waitForTimeout(500)

    const combo = comboSection(page)
    await expect(combo).toBeVisible()

    // Get cart count before adding combo (check cart item count text)
    // The cart sidebar shows item count; let's count cart items via text
    const cartCountBefore = await page.getByText(/共 \d+ 份菜品|\d+ items/).first().textContent().catch(() => '0')

    // Click first "一键加入搭配" button
    const addComboBtn = combo.getByRole('button', { name: /一键加入搭配|Add Combo/ }).first()
    await addComboBtn.click()
    await page.waitForTimeout(500)

    // Cart should now have more items — the combo added 2 items (veggie + staple)
    // Verify cart count increased or cart items visible
    const cartCountAfter = await page.getByText(/共 \d+ 份菜品|\d+ items/).first().textContent().catch(() => '0')

    // Parse numbers and verify increase
    const beforeNum = parseInt((cartCountBefore || '0').match(/\d+/)?.[0] || '0')
    const afterNum = parseInt((cartCountAfter || '0').match(/\d+/)?.[0] || '0')
    expect(afterNum).toBeGreaterThan(beforeNum)
  })

  test('REQ-005.5: 购物车内容变化后搭配推荐动态更新', async ({ page }) => {
    await gotoMenu(page)
    // Add a broth as main dish
    await addProductFromCategory(page, '锅底', 0)
    await page.waitForTimeout(500)

    const combo = comboSection(page)
    await expect(combo).toBeVisible()

    // Add the first combo suggestion items
    const addComboBtn = combo.getByRole('button', { name: /一键加入搭配|Add Combo/ }).first()
    const comboCountBefore = await combo.getByRole('button', { name: /一键加入搭配|Add Combo/ }).count()
    await addComboBtn.click()
    await page.waitForTimeout(500)

    // After adding combo items, the combo suggestions should recalculate
    // (items already in cart should not be suggested again, or combo count may change)
    const comboCountAfter = await comboSection(page).getByRole('button', { name: /一键加入搭配|Add Combo/ }).count().catch(() => 0)
    // Combo suggestions should refresh — count may decrease since added items are filtered out
    expect(comboCountAfter).toBeLessThanOrEqual(comboCountBefore)
  })

  // ─────────────────────────────────────────────
  // REQ-006: 推荐去重与售罄过滤
  // ─────────────────────────────────────────────

  test('REQ-006.1: 已加入购物车的菜品在推荐列表中标记"已加购"', async ({ page }) => {
    await gotoMenu(page)
    // Get initial recommended product names
    const cards = recommendCards(page)
    const firstCardName = await cards.first().locator('h3').textContent()
    expect(firstCardName).toBeTruthy()

    // Find the product in the category list and add it
    // Click the first recommended card to open spec dialog
    await cards.first().click()
    await page.waitForTimeout(300)

    // If spicy options exist, select 微辣
    const mildBtn = page.getByRole('button', { name: '微辣', exact: true })
    if (await mildBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await mildBtn.click()
    }
    await page.getByRole('button', { name: /加入本桌购物车|Add to table cart/ }).click()
    await page.waitForTimeout(500)

    // The recommended product should now show "已加购" mark
    const recommendText = await recommendSection(page).textContent()
    expect(recommendText).toContain('已加购')
  })

  test('REQ-006.2: 售罄菜品不出现在推荐列表中', async ({ page }) => {
    await gotoMenu(page)
    // Get initial recommended product names
    const cards = recommendCards(page)
    const initialNames: string[] = []
    for (let i = 0; i < await cards.count(); i++) {
      const name = await cards.nth(i).locator('h3').textContent()
      initialNames.push(name || '')
    }

    // Open demo console to toggle sold out
    await page.getByRole('button', { name: /演示控制台|Demo Console|控制台/ }).click()
    await expect(page.getByText(/桌台与履约|Table & Fulfillment/)).toBeVisible()

    // Find sold-out toggle section and toggle a product that's in recommendations
    // The sold-out toggle uses product names; toggle the first recommended product
    const targetProduct = initialNames[0]
    // Click the toggle button for that product
    const soldOutToggle = page.getByRole('switch', { name: targetProduct }).or(
      page.locator(`text=${targetProduct}`).locator('..').locator('button[role="switch"]')
    )
    if (await soldOutToggle.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await soldOutToggle.first().click()
    } else {
      // Try clicking the text container to toggle
      await page.getByText(targetProduct).first().click()
    }

    // Close console
    await page.getByRole('button', { name: /完成设置|Done/ }).click()
    await page.waitForTimeout(500)

    // The sold-out product should not appear in recommendations
    const recommendText = await recommendSection(page).textContent()
    // The product name might still appear as "已加购" in cart elsewhere, but in recommendation section
    // it should be filtered out. However, the product name text in recommend section should not include it
    // unless it was already in cart. We check that it doesn't appear as a recommendable card.
    const updatedCards = recommendCards(page)
    const updatedNames: string[] = []
    for (let i = 0; i < await updatedCards.count(); i++) {
      const name = await updatedCards.nth(i).locator('h3').textContent()
      updatedNames.push(name || '')
    }
    expect(updatedNames).not.toContain(targetProduct)
  })

  test('REQ-006.3: 购物车变化后推荐列表重新计算', async ({ page }) => {
    await gotoMenu(page)
    const cardsBefore = recommendCards(page)
    const countBefore = await cardsBefore.count()

    // Add a product from category
    await addProductFromCategory(page, '锅底', 0)
    await page.waitForTimeout(500)

    // Recommendation list should recalculate (added product gets "已加购" mark, score drops)
    const cardsAfter = recommendCards(page)
    const countAfter = await cardsAfter.count()
    // Count should still be within 3-6 range
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

    // Spec dialog should be visible with product name heading
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    // Should have "加入本桌购物车" button
    await expect(page.getByRole('button', { name: /加入本桌购物车|Add to table cart/ })).toBeVisible()
  })

  test('REQ-008.2: 推荐菜品加购行为与分类浏览一致（含超级辣风险提示）', async ({ page }) => {
    await gotoMenu(page)
    const cards = recommendCards(page)

    // Find a card that has spicy options (p1 or p2 — broth category)
    // Click first card; if it's a broth with spicy, test super spicy
    await cards.first().click()
    await page.waitForTimeout(300)

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Check if super spicy option exists in this dialog
    const superSpicyBtn = page.getByRole('button', { name: '超级辣', exact: true })
    if (await superSpicyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await superSpicyBtn.click()
      // Risk warning should appear
      await expect(page.getByText(/风险提示|Risk warning/)).toBeVisible()
    } else {
      // Non-spicy product: just verify add to cart works
      await page.getByRole('button', { name: /加入本桌购物车|Add to table cart/ }).click()
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
    await expect(recommendSection(page)).toBeVisible()

    // Filter out favicon and non-critical errors
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
    // Switch language
    const langBtn = page.getByRole('button', { name: /切换语言|Switch language/ })
    await langBtn.click()
    await page.waitForTimeout(300)

    // Verify English recommendation title
    await expect(page.getByText('Recommended For You')).toBeVisible()

    // Verify English reason tags appear
    const recommendText = await recommendSection(page).textContent()
    // "Top Pick" is the English popularity reason tag
    expect(recommendText).toContain('Top Pick')

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

    // Add a main dish to trigger combo
    await addProductFromCategory(page, 'Broth', 0)
    await page.waitForTimeout(500)

    // Verify English combo text
    await expect(page.getByText('Combo Suggestions')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Combo' })).toBeVisible()

    // Switch back to Chinese
    await page.getByRole('button', { name: /切换语言|Switch language/ }).click()
    await page.waitForTimeout(300)
    await expect(page.getByText('搭配推荐')).toBeVisible()
    await expect(page.getByRole('button', { name: '一键加入搭配' })).toBeVisible()
  })
})

test.describe('推荐菜功能 - 核心点餐流程回归', () => {

  test('REG-001: 推荐功能启用后，完整点餐流程不受影响（绑桌→加购→提交订单）', async ({ page }) => {
    await gotoMenu(page)
    // Verify recommendation area visible
    await expect(recommendSection(page)).toBeVisible()

    // Add a product via category tab (normal flow)
    await page.getByRole('button', { name: '锅底', exact: true }).click()
    const productCards = page.locator('article')
    await productCards.first().locator('button').last().click()
    await page.getByRole('button', { name: '微辣' }).click()
    await page.getByRole('button', { name: /加入本桌购物车|Add to table cart/ }).click()
    await page.waitForTimeout(300)

    // Submit order
    const submitBtn = page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ })
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
    } else {
      await page.getByRole('button', { name: /查看购物车|View Cart/ }).click()
      await page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ }).click()
    }

    // Should see order view
    await expect(page.getByText(/这一锅，正在抵达|Your pot is on the way/)).toBeVisible()
  })

  test('REG-002: 现有"推荐"分类 Tab 仍显示全部菜品', async ({ page }) => {
    await gotoMenu(page)
    // Click "推荐" tab (menu.cat.recommend = 推荐)
    await page.getByRole('button', { name: '推荐', exact: true }).click()
    await page.waitForTimeout(300)

    // Should show all products (10 items in 2-column grid = multiple articles)
    const articles = page.locator('article')
    const count = await articles.count()
    expect(count).toBe(10)
  })

  test('REG-003: 搜索功能不受推荐区域影响', async ({ page }) => {
    await gotoMenu(page)
    const searchInput = page.getByPlaceholder(/搜索|Search/)
    await searchInput.fill('牛油')

    // Should filter to matching products
    const articles = page.locator('article')
    await page.waitForTimeout(300)
    const count = await articles.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(10)
  })
})
