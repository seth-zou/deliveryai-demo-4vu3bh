import { test, expect, type Page } from '@playwright/test'

async function enterMenu(page: Page, navigate = true) {
  if (navigate) await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click()
  await page.getByRole('button', { name: /进入点餐|Start Ordering/ }).click()
}

async function addDish(page: Page, name: string, half = false) {
  await page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) }).getByRole('button').click()
  if (half) await page.getByRole('button', { name: '半份', exact: true }).click()
  await page.getByRole('button', { name: '加入本桌购物车', exact: true }).click()
}

const currencySelect = (page: Page) => page.getByRole('combobox', { name: /展示币种|Display currency/ })

test('顶部独立币种入口切换四种参考价格且默认人民币', async ({ page }) => {
  await enterMenu(page)
  const pot = page.locator('article').filter({ has: page.getByRole('heading', { name: '鎏金番茄鸳鸯锅', exact: true }) })
  await expect(currencySelect(page)).toHaveValue('CNY')
  await expect(pot).toContainText('¥68.00')
  for (const [code, price] of [['USD', 'USD 9.52'], ['EUR', 'EUR 8.84'], ['HKD', 'HKD 74.80'], ['CNY', '¥68.00']]) {
    await currencySelect(page).selectOption(code)
    await expect(pot).toContainText(price)
  }
  await expect(page.getByText(/演示汇率.*0.14 USD.*0.13 EUR.*1.10 HKD/)).toBeVisible()
})

test('购物车订单报价与人民币优惠支付保持一致，成功页保留支付快照', async ({ page }) => {
  await enterMenu(page)
  await currencySelect(page).selectOption('USD')
  await addDish(page, '鎏金番茄鸳鸯锅')
  await addDish(page, '牛油麻辣锅')
  await addDish(page, '琥珀嫩牛肉')
  await addDish(page, '雪花肥牛卷')
  const cart = page.locator('aside')
  await expect(cart.getByText('预估合计').locator('..')).toContainText('USD 30.38')
  await expect(cart).toContainText('USD 9.52')
  await page.getByRole('button', { name: '确认并提交订单', exact: true }).click()
  await expect(page.getByText('菜品合计').locator('..')).toContainText('USD 30.38')
  await page.getByRole('button', { name: '去结账', exact: true }).click()
  await expect(page.getByText('参考小计').locator('..')).toContainText('USD 30.38')
  await expect(page.getByText('参考优惠', { exact: true }).locator('..')).toContainText('-USD 2.80')
  await expect(page.getByText('参考应付', { exact: true }).locator('..')).toContainText('USD 27.58')
  await expect(page.getByText('人民币实际应付').locator('..')).toContainText('¥197.00')
  await expect(page.getByRole('button', { name: /确认支付/ })).toContainText('¥197.00')
  await page.getByRole('button', { name: /确认支付/ }).click()
  await expect(page.getByText('人民币实付金额').locator('..')).toContainText('¥197.00')
  await currencySelect(page).selectOption('EUR')
  await expect(page.getByText('参考实付金额', { exact: true }).locator('..')).toContainText('EUR 25.61')
  await page.getByRole('button', { name: '返回订单', exact: true }).click()
  await page.getByRole('button', { name: '继续加菜', exact: true }).click()
  await addDish(page, '柠檬青桔饮')
  await page.getByRole('button', { name: '确认并提交订单', exact: true }).click()
  await expect(page.getByText('菜品合计').locator('..')).toContainText('EUR 30.55')
  await page.getByRole('button', { name: '去结账', exact: true }).click()
  await expect(page.getByText('人民币实付金额').locator('..')).toContainText('¥197.00')
  await expect(page.getByText('参考实付金额', { exact: true }).locator('..')).toContainText('EUR 25.61')
})

test('半份规格金额与手机购物车一致，券金额也按展示币种参考换算', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await enterMenu(page)
  await currencySelect(page).selectOption('USD')
  await page.locator('article').filter({ has: page.getByRole('heading', { name: '琥珀嫩牛肉', exact: true }) }).getByRole('button').click()
  await expect(page.getByRole('dialog')).toContainText('USD 5.88')
  await page.getByRole('button', { name: '半份', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('USD 3.36')
  await page.getByRole('button', { name: '加入本桌购物车', exact: true }).click()
  await expect(page.getByRole('button', { name: /查看购物车/ })).toContainText('USD 3.36')
  await page.getByRole('button', { name: /查看购物车/ }).click()
  await expect(page.getByRole('dialog').getByText('预估合计').locator('..')).toContainText('USD 3.36')
  await page.getByRole('button', { name: '提交加菜', exact: true }).click()
  await page.getByRole('button', { name: '去结账', exact: true }).click()
  await expect(page.getByRole('button', { name: /确认支付/ })).toContainText('¥24.00')
  await page.getByRole('button', { name: '会员与排号', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('¥30')
  await expect(page.getByRole('dialog')).toContainText('USD 4.20')
})

test('币种偏好在刷新、切换语言和重置演示后保留', async ({ page }) => {
  await enterMenu(page)
  await currencySelect(page).selectOption('HKD')
  await page.reload()
  await enterMenu(page, false)
  await expect(currencySelect(page)).toHaveValue('HKD')
  await page.getByRole('button', { name: '切换语言', exact: true }).click()
  await expect(currencySelect(page)).toHaveValue('HKD')
  await expect(page.locator('article').first()).toContainText('HKD 74.80')
  await page.getByRole('button', { name: 'Demo Console', exact: true }).click()
  await page.getByRole('button', { name: 'Reset Demo', exact: true }).click()
  await enterMenu(page, false)
  await expect(currencySelect(page)).toHaveValue('HKD')
  await expect(page.getByRole('combobox', { name: 'Display currency' })).toBeVisible()
})

test('非法本地偏好回退人民币，用户仍可选择有效币种', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('display-currency', 'GBP'))
  await enterMenu(page)
  await expect(currencySelect(page)).toHaveValue('CNY')
  await expect(page.locator('article').first()).toContainText('¥68.00')
  await currencySelect(page).selectOption('EUR')
  await expect(page.locator('article').first()).toContainText('EUR 8.84')
})

test('浏览器存储不可用仍可切换币种并完成人民币支付', async ({ page }) => {
  // Storage is an external browser boundary; app state and pricing remain real.
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage unavailable') }
    Storage.prototype.setItem = () => { throw new Error('storage unavailable') }
  })
  await enterMenu(page)
  await expect(currencySelect(page)).toHaveValue('CNY')
  await currencySelect(page).selectOption('USD')
  await addDish(page, '鎏金番茄鸳鸯锅')
  await page.getByRole('button', { name: '确认并提交订单', exact: true }).click()
  await expect(currencySelect(page)).toHaveValue('USD')
  await page.getByRole('button', { name: '去结账', exact: true }).click()
  await expect(page.getByRole('button', { name: /确认支付/ })).toContainText('¥68.00')
  await page.getByRole('button', { name: /确认支付/ }).click()
  await expect(page.getByText('参考实付金额', { exact: true }).locator('..')).toContainText('USD 9.52')
})

test('320px窄屏、深色和老人模式顶部操作可访问且币种支持键盘', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await enterMenu(page)
  await page.getByRole('button', { name: '切换主题', exact: true }).click()
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click()
  await page.getByRole('button', { name: '切换至老人模式', exact: true }).click()
  await page.getByRole('button', { name: '切换语言', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveClass(/elderly/)
  await currencySelect(page).focus()
  await currencySelect(page).press('u')
  await currencySelect(page).press('Enter')
  await expect(currencySelect(page)).toHaveValue('USD')
  await expect(page.locator('article').first()).toContainText('USD 9.52')
  for (const control of await page.locator('header').getByRole('button').all()) {
    if (!await control.isVisible()) continue
    const box = await control.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  }
  const selectBox = await currencySelect(page).boundingBox()
  expect(selectBox!.x + selectBox!.width).toBeLessThanOrEqual(320)
  await page.locator('article').first().getByRole('button').click()
  await page.getByRole('button', { name: 'Add to Table Cart', exact: true }).click()
  const mobileCart = page.getByRole('button', { name: /View Cart/ })
  await expect(mobileCart).toContainText('USD 9.52')
  await expect(mobileCart).toContainText('For reference only')
  const cartBox = await mobileCart.boundingBox()
  expect(cartBox!.x).toBeGreaterThanOrEqual(0)
  expect(cartBox!.x + cartBox!.width).toBeLessThanOrEqual(320)
  const assistantBox = await page.getByRole('button', { name: 'Smart Order Assistant', exact: true }).boundingBox()
  expect(cartBox!.y + cartBox!.height).toBeLessThanOrEqual(assistantBox!.y)
  await page.screenshot({ path: 'e2e-report/currency-mobile-dark-elderly.png' })
})
