import { test, expect, type Page } from '@playwright/test'

async function gotoMenu(page: Page) {
  await page.goto('/?preview=menu')
  await expect(page.getByText('想吃什么，一起点。')).toBeVisible()
}

// 币种下拉触发按钮
function currencyButton(page: Page) {
  return page.getByRole('button', { name: /切换币种|Switch currency/ })
}

// 打开下拉并按货币名称选择（zh 文案）
async function selectCurrency(page: Page, label: string) {
  await currencyButton(page).click()
  await page.getByRole('menuitemradio', { name: new RegExp(label) }).click()
}

// 首个菜品价格文本
function firstPrice(page: Page) {
  return page.locator('p.text-xl.font-extrabold.text-chili-500').first()
}

test.describe('多币种金额展示', () => {
  test('CUR-001: 默认展示 CNY（¥ 符号，两位小数）', async ({ page }) => {
    await gotoMenu(page)
    await expect(currencyButton(page)).toHaveText('¥')
    const priceText = await firstPrice(page).textContent()
    expect(priceText).toMatch(/^¥\d[\d,]*\.\d{2}/)
  })

  test('CUR-002: 下拉展示全部六种货币可选项', async ({ page }) => {
    await gotoMenu(page)
    await currencyButton(page).click()
    for (const label of ['人民币', '美元', '欧元', '日元', '港币', '新台币']) {
      await expect(page.getByRole('menuitemradio', { name: new RegExp(label) })).toBeVisible()
    }
    // 当前 CNY 项被标记为选中
    await expect(page.getByRole('menuitemradio', { name: /人民币/ })).toHaveAttribute('aria-checked', 'true')
  })

  test('CUR-003: 切换到 USD 后展示 $ 符号且金额被换算', async ({ page }) => {
    await gotoMenu(page)
    const cnyText = await firstPrice(page).textContent()
    await selectCurrency(page, '美元')
    await expect(currencyButton(page)).toHaveText('$')
    const usdText = await firstPrice(page).textContent()
    expect(usdText).toMatch(/^\$\d[\d,]*\.\d{2}/)
    // 换算生效：USD 金额不等于把 CNY 数字直接套 $（汇率 < 1，数值应更小）
    const cnyNum = Number((cnyText ?? '').replace(/[^\d.]/g, ''))
    const usdNum = Number((usdText ?? '').replace(/[^\d.]/g, ''))
    expect(usdNum).toBeLessThan(cnyNum)
  })

  test('CUR-004: JPY 与 TWD 取整（无小数）', async ({ page }) => {
    await gotoMenu(page)
    await selectCurrency(page, '日元')
    await expect(currencyButton(page)).toHaveText('¥')
    let priceText = await firstPrice(page).textContent()
    expect(priceText).toMatch(/^¥\d[\d,]*$/)
    expect(priceText).not.toMatch(/\./)

    await selectCurrency(page, '新台币')
    await expect(currencyButton(page)).toHaveText('NT$')
    priceText = await firstPrice(page).textContent()
    expect(priceText).toMatch(/^NT\$\d[\d,]*$/)
    expect(priceText).not.toMatch(/\./)
  })

  test('CUR-005: EUR / HKD 两位小数与对应符号', async ({ page }) => {
    await gotoMenu(page)
    await selectCurrency(page, '欧元')
    await expect(currencyButton(page)).toHaveText('€')
    expect(await firstPrice(page).textContent()).toMatch(/^€\d[\d,]*\.\d{2}/)

    await selectCurrency(page, '港币')
    await expect(currencyButton(page)).toHaveText('HK$')
    expect(await firstPrice(page).textContent()).toMatch(/^HK\$\d[\d,]*\.\d{2}/)
  })

  test('CUR-006: 切换回 CNY 后恢复 ¥ 符号', async ({ page }) => {
    await gotoMenu(page)
    await selectCurrency(page, '美元')
    await expect(currencyButton(page)).toHaveText('$')
    await selectCurrency(page, '人民币')
    await expect(currencyButton(page)).toHaveText('¥')
    expect(await firstPrice(page).textContent()).toMatch(/^¥/)
  })

  test('CUR-007: 选择持久化到 localStorage', async ({ page }) => {
    await gotoMenu(page)
    await selectCurrency(page, '欧元')
    const stored = await page.evaluate(() => localStorage.getItem('currency'))
    expect(stored).toBe('EUR')
  })

  test('CUR-008: 首次访问默认 CNY', async ({ page }) => {
    await page.goto('/?preview=menu')
    await expect(currencyButton(page)).toHaveText('¥')
    const stored = await page.evaluate(() => localStorage.getItem('currency'))
    expect(stored).toBe('CNY')
  })

  test('CUR-009: localStorage 不可用时切换仍即时生效', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('localStorage not available')
        },
      })
    })
    await page.goto('/?preview=menu')
    await expect(currencyButton(page)).toHaveText('¥')
    await selectCurrency(page, '日元')
    await expect(currencyButton(page)).toHaveText('¥')
    expect(await firstPrice(page).textContent()).toMatch(/^¥\d[\d,]*$/)
  })

  test('CUR-010: 币种切换不影响语言切换', async ({ page }) => {
    await gotoMenu(page)
    await selectCurrency(page, '美元')
    await expect(currencyButton(page)).toHaveText('$')
    await page.getByRole('button', { name: /切换语言|Switch language/ }).click()
    // 语言切换后币种仍为 USD
    await expect(currencyButton(page)).toHaveText('$')
  })

  test('CUR-011: 硬编码 ¥ 文案不受币种切换影响', async ({ page }) => {
    await gotoMenu(page)
    await selectCurrency(page, '美元')
    await page.getByRole('button', { name: /会员|Membership/ }).click()
    await expect(page.getByText(/¥30/)).toBeVisible()
  })

  test('CUR-012: 完整点餐流程在 USD 模式下购物车金额换算展示', async ({ page }) => {
    await gotoMenu(page)
    await selectCurrency(page, '美元')
    await expect(currencyButton(page)).toHaveText('$')
    await page.locator('article button:has(svg.lucide-plus)').first().click()
    await page.getByRole('button', { name: /加入本桌购物车|Add to Table Cart/ }).click()
    await expect(page.locator('aside').locator('text=/\\$/')).toBeVisible()
  })
})
