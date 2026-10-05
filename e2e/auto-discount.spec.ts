import { test, expect, type Page } from '@playwright/test'

/**
 * 自动满减（满200减20）E2E 验收测试
 *
 * 覆盖 Spec SPEC-AUTO-DISCOUNT-200-20 的核心验收标准：
 * - 订单金额 < 200 元：不享受满减，按原价计算
 * - 订单金额 ≥ 200 元：自动减免 20 元，实付金额 = 订单金额 - 20
 * - 结账页清晰展示原价、满减优惠金额、最终实付金额（满减行仅在命中时展示）
 *
 * 价格基线（全份，来自 src/data/menu.ts）：
 *   p1 鎏金番茄鸳鸯锅 ¥68 / p2 牛油麻辣锅 ¥59 / p3 琥珀嫩牛肉 ¥42 / p4 雪花肥牛卷 ¥48
 */

/** 从应用启动导航到菜单视图（绑定桌台 + 进入点餐） */
async function gotoMenu(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click()
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
}

/**
 * 在指定分类下打开第 productIndex 个商品的规格弹窗，使用默认规格加入本桌购物车。
 * 锅底类默认辣度/口味已预选；肉类默认全份（价格不打折），直接加入即可。
 */
async function addProduct(page: Page, category: string, productIndex: number) {
  await page.getByRole('button', { name: category }).click()
  const productCards = page.locator('article')
  await productCards.nth(productIndex).locator('button').last().click()
  await page.getByRole('button', { name: /加入本桌购物车|Add to table cart/ }).click()
  await page.waitForTimeout(200)
}

/** 提交订单并进入结账页 */
async function gotoCheckout(page: Page) {
  await page.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ }).click()
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /去结账|Checkout/ }).click()
  await expect(page.getByText(/核对本桌账单/)).toBeVisible()
}

test.describe('自动满减 满200减20 - E2E 验收测试', () => {
  test('REQ-001: 订单金额≥200元自动减免20元，实付=订单金额-20', async ({ page }) => {
    await gotoMenu(page)
    // p1(¥68) + p2(¥59) + p3(¥42) + p4(¥48) = ¥217 ≥ 200
    await addProduct(page, '锅底', 0) // p1
    await addProduct(page, '锅底', 1) // p2
    await addProduct(page, '牛羊肉', 0) // p3
    await addProduct(page, '牛羊肉', 1) // p4
    await gotoCheckout(page)

    // 原价（菜品小计）
    await expect(page.getByText('菜品小计').locator('..').getByText('¥217.00')).toBeVisible()
    // 满减优惠行可见，文案为「满200减20」，优惠金额 -¥20.00
    await expect(page.getByText('满200减20')).toBeVisible()
    await expect(page.getByText('-¥20.00')).toBeVisible()
    // 应付合计 = 217 - 20 = 197
    await expect(page.getByText('应付合计').locator('..').getByText('¥197.00')).toBeVisible()
    // 确认支付按钮金额为实付金额
    await expect(page.getByRole('button', { name: /确认支付/ })).toContainText('¥197.00')
  })

  test('REQ-002: 订单金额<200元不享受满减，无满减优惠行', async ({ page }) => {
    await gotoMenu(page)
    // p1(¥68) + p3(¥42) = ¥110 < 200
    await addProduct(page, '锅底', 0) // p1
    await addProduct(page, '牛羊肉', 0) // p3
    await gotoCheckout(page)

    // 原价
    await expect(page.getByText('菜品小计').locator('..').getByText('¥110.00')).toBeVisible()
    // 未达阈值：满减优惠行不展示
    await expect(page.getByText('满200减20')).not.toBeVisible()
    // 不应出现 0 元满减优惠行
    await expect(page.getByText('-¥0.00')).not.toBeVisible()
    // 应付合计 = 原价 110（未减免）
    await expect(page.getByText('应付合计').locator('..').getByText('¥110.00')).toBeVisible()
    await expect(page.getByRole('button', { name: /确认支付/ })).toContainText('¥110.00')
  })

  test('REQ-003: 边界值订单金额=200元，命中满减减免20元', async ({ page }) => {
    await gotoMenu(page)
    // p1(¥68) + p3(¥42) + p4(¥48) + p3(¥42) = ¥200（边界值，≥200 命中）
    await addProduct(page, '锅底', 0) // p1
    await addProduct(page, '牛羊肉', 0) // p3
    await addProduct(page, '牛羊肉', 1) // p4
    await addProduct(page, '牛羊肉', 0) // p3 再次添加
    await gotoCheckout(page)

    // 原价正好 200
    await expect(page.getByText('菜品小计').locator('..').getByText('¥200.00')).toBeVisible()
    // 命中满减：优惠行可见
    await expect(page.getByText('满200减20')).toBeVisible()
    await expect(page.getByText('-¥20.00')).toBeVisible()
    // 应付合计 = 200 - 20 = 180
    await expect(page.getByText('应付合计').locator('..').getByText('¥180.00')).toBeVisible()
    // 完成支付后，成功页展示实付金额 ¥180.00
    await page.getByRole('button', { name: /确认支付/ }).click()
    await expect(page.getByText(/付款完成/)).toBeVisible()
    await expect(page.getByText('¥180.00')).toBeVisible()
  })
})
