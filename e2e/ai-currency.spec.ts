import { test, expect, type Page } from '@playwright/test'

async function openAssistant(page: Page) {
  await page.addInitScript(() => localStorage.setItem('harnessrouter_api_key', 'mock-key'))
  await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click()
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
  await page.getByRole('button', { name: /智能点单助理|Smart Order Assistant/ }).click()
}

function sseText(text: string, id: string): string {
  return [
    `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: text })}`,
    `data: ${JSON.stringify({ type: 'response.completed', response: { id, output: [] } })}`,
    '', '',
  ].join('\n')
}

test('AI default CNY turn visibly retains its message currency', async ({ page }) => {
  await page.route('**/api/chat*', (route) => route.fulfill({
    contentType: 'text/event-stream', body: sseText('默认人民币回复', 'resp_cny'),
  }))
  await openAssistant(page)
  await page.getByPlaceholder(/输入你想吃的|Type what you'd like/).fill('看看菜单')
  await page.keyboard.press('Enter')
  const reply = page.locator('[data-message-role="assistant"][data-message-currency="CNY"]')
  await expect(reply).toContainText('默认人民币回复')
  await expect(reply.getByLabel('Currency: CNY')).toHaveText('CNY')
  await expect(page.locator('[data-message-role="user"][data-message-currency="CNY"]')).toContainText('看看菜单')
})

test('in-flight USD tools retain USD while the next response chain uses EUR and history keeps its labels', async ({ page }) => {
  let releaseFirst!: () => void
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
  const requests: Array<{
    metadata: { currency: string }; instructions: string;
    input: string | Array<{ output: string }>; previous_response_id?: string;
  }> = []
  await page.route('**/api/chat*', async (route) => {
    requests.push(route.request().postDataJSON())
    const round = requests.length
    if (round === 1) await firstGate
    const calls = round === 1
      ? [{ type: 'function_call', call_id: 'add', name: 'add_to_cart', arguments: '{"product_id":"p3","portion":"半份"}' }]
      : round === 3
        ? [{ type: 'function_call', call_id: 'cart', name: 'get_cart', arguments: '{}' }]
        : []
    await route.fulfill({
      contentType: 'text/event-stream',
      body: calls.length
        ? `data: ${JSON.stringify({ type: 'response.completed', response: { id: `resp_tool_${round}`, output: calls } })}\n\n`
        : sseText(round === 2 ? '美元轮回复' : '欧元轮回复', round === 2 ? 'resp_usd' : 'resp_eur'),
    })
  })
  await openAssistant(page)
  const currency = page.getByRole('combobox', { name: /展示币种|Display currency/ })
  await currency.selectOption('USD')
  const input = page.getByPlaceholder(/输入你想吃的|Type what you'd like/)
  await input.fill('来半份牛肉')
  await page.keyboard.press('Enter')
  await expect.poll(() => requests.length).toBe(1)
  await expect(page.getByRole('button', { name: /停止|Stop/ })).toBeVisible()
  await expect(page.locator('[data-message-role="assistant"][data-message-currency="USD"]')).toBeVisible()

  await currency.selectOption('EUR')
  await expect(page.getByRole('button', { name: /停止|Stop/ })).toBeVisible()
  await expect(page.locator('[data-message-role="assistant"][data-message-currency="USD"]')).toBeVisible()
  releaseFirst()
  const usdReply = page.locator('[data-message-role="assistant"][data-message-currency="USD"]')
  await expect(usdReply).toContainText('美元轮回复')
  expect(requests[0].metadata.currency).toBe('USD')
  expect(requests[1].metadata.currency).toBe('USD')
  expect(requests[1].instructions).toContain('Display currency: USD')
  expect((requests[1].input as Array<{ output: string }>)[0].output).toMatch(/人民币原价 CNY ¥24\.00.*参考 USD 3\.36/)

  await input.fill('现在看购物车')
  await page.keyboard.press('Enter')
  const eurReply = page.locator('[data-message-role="assistant"][data-message-currency="EUR"]')
  await expect(eurReply).toContainText('欧元轮回复')
  expect(requests[2].previous_response_id).toBe('resp_usd')
  expect(requests[2].metadata.currency).toBe('EUR')
  expect(requests[2].instructions).toContain('Display currency: EUR')
  expect(requests[3].metadata.currency).toBe('EUR')
  expect((requests[3].input as Array<{ output: string }>)[0].output).toMatch(/合计[^\n]*人民币 CNY ¥24\.00.*参考 EUR 3\.12/)
  await expect(usdReply).toContainText('美元轮回复')
  await expect(usdReply.getByLabel('Currency: USD')).toHaveText('USD')

  await currency.selectOption('HKD')
  await expect(eurReply.getByLabel('Currency: EUR')).toHaveText('EUR')
  await currency.selectOption('CNY')
  await expect(page.locator('[data-message-currency="USD"]')).toHaveCount(2)
  await expect(page.locator('[data-message-currency="EUR"]')).toHaveCount(2)
  // Close the panel to inspect the cart's actual CNY price after AI half-portion add.
  await page.getByRole('button', { name: /关闭|Close/ }).last().click()
  await expect(page.getByText('¥24.00', { exact: true }).first()).toBeVisible()
})
