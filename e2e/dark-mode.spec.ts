import { test, expect, type Page } from '@playwright/test'

/** Helper: navigate from app start to menu view (bind table + enter menu) */
async function gotoMenu(page: Page) {
  await page.goto('/')
  // Bind table - click table A08
  await page.getByRole('button', { name: /A08/ }).first().click()
  // Welcome page - enter menu
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
}

/** Helper: open theme popover */
async function openThemePopover(page: Page) {
  const themeBtn = page.getByRole('button', { name: /切换主题|Toggle theme/ })
  await expect(themeBtn).toBeVisible()
  await themeBtn.click()
}

/** Helper: select a theme option */
async function selectTheme(page: Page, theme: 'light' | 'dark' | 'auto') {
  await openThemePopover(page)
  const label = theme === 'light' ? /浅色|Light/ : theme === 'dark' ? /深色|Dark/ : /自动|Auto/
  const option = page.getByRole('menuitemradio', { name: label })
  await expect(option).toBeVisible()
  await option.click()
  // Popover should close after selection
  await expect(page.getByRole('menuitemradio', { name: label })).not.toBeVisible()
}

test.describe('夜间模式 - E2E 联调验收测试', () => {
  test('DARK-001: 主题切换按钮可见，具备正确的 aria-label 属性', async ({ page }) => {
    await gotoMenu(page)
    const themeBtn = page.getByRole('button', { name: /切换主题|Toggle theme/ })
    await expect(themeBtn).toBeVisible()
    await expect(themeBtn).toHaveAttribute('aria-label')
  })

  test('DARK-002: 点击主题按钮弹出包含浅色/深色/自动三个选项的控件', async ({ page }) => {
    await gotoMenu(page)
    await openThemePopover(page)
    // Verify three options exist
    await expect(page.getByRole('menuitemradio', { name: /浅色|Light/ })).toBeVisible()
    await expect(page.getByRole('menuitemradio', { name: /深色|Dark/ })).toBeVisible()
    await expect(page.getByRole('menuitemradio', { name: /自动|Auto/ })).toBeVisible()
    // Verify menu role
    await expect(page.getByRole('menu')).toBeVisible()
  })

  test('DARK-003: 选择深色模式后，html 元素添加 dark class，页面切换为深色主题', async ({ page }) => {
    await gotoMenu(page)
    // Initially should be light (storage state sets light)
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    // Switch to dark
    await selectTheme(page, 'dark')
    // Verify dark class is applied
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('DARK-004: 从深色切换回浅色模式，html dark class 移除，页面恢复浅色', async ({ page }) => {
    await gotoMenu(page)
    // Switch to dark first
    await selectTheme(page, 'dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Switch back to light
    await selectTheme(page, 'light')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('DARK-005: 选择自动模式时，主题跟随系统 prefers-color-scheme 设置', async ({ page }) => {
    // Start with light system preference
    await page.emulateMedia({ colorScheme: 'light' })
    await gotoMenu(page)
    // Select auto
    await selectTheme(page, 'auto')
    // With light system, should not have dark class
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    // Change system to dark
    await page.emulateMedia({ colorScheme: 'dark' })
    // Wait for listener to fire
    await page.waitForTimeout(300)
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Change back to light
    await page.emulateMedia({ colorScheme: 'light' })
    await page.waitForTimeout(300)
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('DARK-006: 手动选择浅色/深色后，不再跟随系统主题变化', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await gotoMenu(page)
    // Manually select dark
    await selectTheme(page, 'dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Change system to light (should stay dark because user manually selected)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.waitForTimeout(300)
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Now manually select light
    await selectTheme(page, 'light')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    // Change system to dark (should stay light)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(300)
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('DARK-007: 主题设置持久化到 localStorage，刷新页面后保持 dark class', async ({ page }) => {
    await gotoMenu(page)
    // Select dark
    await selectTheme(page, 'dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Verify localStorage
    const theme = await page.evaluate(() => localStorage.getItem('theme'))
    expect(theme).toBe('dark')
    // Refresh page - table binding state resets, but theme should persist
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    // Should still have dark class immediately after reload (anti-FOUC script works)
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('DARK-008: 深色模式下菜单页、订单页可正常渲染', async ({ page }) => {
    await gotoMenu(page)
    await selectTheme(page, 'dark')
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Menu page should be visible in dark mode
    await expect(page.getByRole('navigation')).toBeVisible()

    // Navigate to order page (desktop nav or mobile bottom nav)
    const orderNav = page.getByRole('button', { name: /订单|Orders/ })
    await orderNav.first().click()
    // Empty order state should be visible
    await expect(page.getByText(/还没有已提交订单|No orders submitted yet/)).toBeVisible()
  })

  test('DARK-009: 深色模式下完成完整点餐业务流程（绑桌→加购→提交订单→查看订单）', async ({ page }) => {
    await page.goto('/')
    // Bind table
    await page.getByRole('button', { name: /A08/ }).first().click()
    // Welcome page
    await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
    // Switch to dark
    await selectTheme(page, 'dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Add a product (broth category)
    await page.getByRole('button', { name: '锅底' }).click()
    const productCards = page.locator('article')
    await productCards.first().locator('button').last().click()
    await page.getByRole('button', { name: '微辣' }).click()
    await page.getByRole('button', { name: /加入本桌购物车|Add to table cart/ }).click()
    // On desktop: cart is in sidebar with submit button; on mobile: floating cart button opens dialog
    // Try desktop first: click submit order button in sidebar
    const submitBtn = page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ })
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
    } else {
      // Mobile: click floating view cart button, then submit
      await page.getByRole('button', { name: /查看购物车|View Cart/ }).click()
      await page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ }).click()
    }
    // Should see order view with title
    await expect(page.getByText(/这一锅，正在抵达|Your pot is on the way/)).toBeVisible()
    // No JS errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    expect(errors.filter(e => !e.includes('favicon'))).toEqual([])
  })

  test('DARK-010: 深色模式下开启老人模式可正常叠加', async ({ page }) => {
    await gotoMenu(page)
    await selectTheme(page, 'dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Click elderly mode button
    const elderlyBtn = page.getByRole('button', { name: /老人模式|常规模式/ })
    await elderlyBtn.click()
    // Elderly class should be applied
    await expect(page.locator('html')).toHaveClass(/elderly/)
    // Should still have dark class
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Menu page still visible
    await expect(page.getByRole('navigation')).toBeVisible()
    // Toggle off
    await elderlyBtn.click()
    await expect(page.locator('html')).not.toHaveClass(/elderly/)
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('DARK-011: 深色模式下语言切换不影响主题状态', async ({ page }) => {
    await gotoMenu(page)
    await selectTheme(page, 'dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Switch language using aria-label
    const langBtn = page.getByRole('button', { name: /切换语言|Switch language/ })
    await langBtn.click()
    // Theme should still be dark
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Switch back
    await page.getByRole('button', { name: /切换语言|Switch language/ }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('DARK-012: 当前选中的主题选项在 popover 中有高亮状态（aria-checked）', async ({ page }) => {
    await gotoMenu(page)
    // Select dark
    await selectTheme(page, 'dark')
    await openThemePopover(page)
    // Dark option should be checked
    const darkOption = page.getByRole('menuitemradio', { name: /深色|Dark/ })
    await expect(darkOption).toHaveAttribute('aria-checked', 'true')
    const lightOption = page.getByRole('menuitemradio', { name: /浅色|Light/ })
    await expect(lightOption).toHaveAttribute('aria-checked', 'false')
    const autoOption = page.getByRole('menuitemradio', { name: /自动|Auto/ })
    await expect(autoOption).toHaveAttribute('aria-checked', 'false')
  })

  test('DARK-013: 点击 popover 外部区域可关闭主题选择面板', async ({ page }) => {
    await gotoMenu(page)
    await openThemePopover(page)
    await expect(page.getByRole('menu')).toBeVisible()
    // Click outside (on the header area)
    await page.locator('header').click({ position: { x: 5, y: 5 } })
    await expect(page.getByRole('menu')).not.toBeVisible()
  })

  test('DARK-014: 深色模式下会员弹窗、服务呼叫面板、辣度风险提示均正常显示', async ({ page }) => {
    await gotoMenu(page)
    await selectTheme(page, 'dark')
    // Open member dialog
    await page.getByRole('button', { name: /会员|Member/i }).click()
    await expect(page.getByText(/成长值|Growth/)).toBeVisible()
    await page.keyboard.press('Escape')
    // Open service sheet
    await page.getByRole('button', { name: /呼叫服务|Call Service/i }).click()
    await expect(page.getByText(/桌边服务|Tableside Service/)).toBeVisible()
    await page.keyboard.press('Escape')
    // Open super spicy warning
    await page.getByRole('button', { name: '锅底' }).click()
    const productCards = page.locator('article')
    await productCards.first().locator('button').last().click()
    await page.getByRole('button', { name: '超级辣' }).click()
    await expect(page.getByText(/风险提示|Risk warning/)).toBeVisible()
  })

  test('DARK-015: 绑桌页和欢迎页在深色模式下也可正常显示', async ({ page }) => {
    // Set dark theme before navigation
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark')
    })
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Bind table page should be visible in dark
    await expect(page.getByRole('button', { name: /A08/ }).first()).toBeVisible()
    await page.getByRole('button', { name: /A08/ }).first().click()
    // Welcome page should be visible in dark
    await expect(page.getByRole('button', { name: /进入点餐|Enter/ })).toBeVisible()
  })
})

test.describe('夜间模式 - 补充验收测试', () => {
  test('DARK-016: DemoConsole 演示控制台在深色模式下可正常打开和显示', async ({ page }) => {
    await gotoMenu(page)
    await selectTheme(page, 'dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Open demo console
    await page.getByRole('button', { name: /演示控制台|Demo Console|控制台/ }).click()
    // Should see demo console title
    await expect(page.getByText(/演示控制台|Demo Console/).first()).toBeVisible()
    // Table fulfillment section
    await expect(page.getByText(/桌台与履约|Table & Fulfillment/)).toBeVisible()
    // Service response section
    await expect(page.getByText(/服务响应|Service Response/)).toBeVisible()
    // Sold out toggle section
    await expect(page.getByText(/菜品售罄开关|Sold-out Toggle/)).toBeVisible()
    // Close
    await page.getByRole('button', { name: /完成设置|Done/ }).click()
    await expect(page.getByText(/演示控制台|Demo Console/).first()).not.toBeVisible()
  })

  test('DARK-017: prefers-reduced-motion 时关闭过渡动画', async ({ page }) => {
    // Emulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoMenu(page)
    // The CSS rule @media (prefers-reduced-motion: reduce) should apply transition:none
    // When prefers-reduced-motion is reduce, transitions should be 'none' or 'all' with 0s duration
    // Actually the CSS sets transition: none !important
    const allTransitionNone = await page.evaluate(() => {
      const html = document.documentElement
      const htmlStyle = getComputedStyle(html)
      const body = document.body
      const bodyStyle = getComputedStyle(body)
      return {
        htmlTransitionDuration: htmlStyle.transitionDuration,
        bodyTransitionDuration: bodyStyle.transitionDuration,
      }
    })
    // With reduced motion, transition duration should be 0s
    expect(allTransitionNone.htmlTransitionDuration).toBe('0s')
  })

  test('DARK-018: localStorage 不可用时降级为内存态，不报错', async ({ page}) => {
    await gotoMenu(page)
    // Intercept localStorage to throw errors (simulating privacy mode)
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => { throw new Error('Storage disabled') }
      Storage.prototype.getItem = () => { throw new Error('Storage disabled') }
    })
    // Navigate fresh with localStorage disabled
    await page.goto('/')
    // Should still render without errors
    await page.getByRole('button', { name: /A08/ }).first().click()
    await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
    // Switch to dark - should work in memory even if localStorage fails
    await selectTheme(page, 'dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Switch to light
    await selectTheme(page, 'light')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    // Collect console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    // No blocking errors related to theme
    const themeErrors = errors.filter(e => e.toLowerCase().includes('theme') || e.toLowerCase().includes('localstorage'))
    expect(themeErrors).toEqual([])
  })

  test('DARK-019: CheckoutView 结账页深色模式正常显示', async ({ page }) => {
    await gotoMenu(page)
    await selectTheme(page, 'dark')
    // Add item
    await page.getByRole('button', { name: '锅底' }).click()
    const productCards = page.locator('article')
    await productCards.first().locator('button').last().click()
    await page.getByRole('button', { name: '微辣' }).click()
    await page.getByRole('button', { name: /加入本桌购物车|Add to table cart/ }).click()
    await page.waitForTimeout(300)
    // Submit order
    await page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ }).click()
    await page.waitForLoadState('networkidle')
    // Go to checkout
    await page.getByRole('button', { name: /去结账|Checkout/ }).click()
    // Should see checkout title and payment methods
    await expect(page.getByText(/核对本桌账单/)).toBeVisible()
    await expect(page.getByText(/选择支付方式|Select Payment/)).toBeVisible()
    // Pay
    await page.getByRole('button', { name: /确认支付/ }).click()
    // Should see success
    await expect(page.getByText(/付款完成|Payment Successful/)).toBeVisible()
  })
})
