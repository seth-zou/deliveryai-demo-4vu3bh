# Design

## Context

见 proposal.md - Why。现状：`Currency = 'CNY' | 'USD'`，`money(value, currency)` 仅切换符号、无换算；货币状态由 `CurrencyProvider` + `useCurrency` 管理，`toggle()` 做二态翻转，选择持久化到 `localStorage['currency']`；TopBar 用 `¥/$` 二态按钮触发切换。所有小计/总价以 `reduce` 按 `item.price * quantity` 累加，`item.price` 与 `menu.ts` 定价均为 CNY 原值。约束：demo 项目，保持改动最小集中；所有展示文案走 i18next（zh/en 双份）；`money()` 已在 5 处展示组件被调用且都已传入 currency。

## Goals / Non-Goals

**Goals:**
- 让 `money()` 成为唯一的"换算 + 取整 + 符号"边界，展示组件调用签名零改动。
- 六种货币的换算与按币种精度取整行为集中在 `src/lib/utils.ts`。
- 货币状态从二态升级为多值选择，且向后兼容既有持久化值。

**Non-Goals:**
- 不改动 `menu.ts` 商品底价（保持 CNY）。
- 不引入外部实时汇率服务或后端参与。
- 不改动满减业务规则本身（仅确认其停留在 CNY 层）。
- 不做三位小数货币（本次货币集合中无此类）。

## Decisions

**决策 1：底价 CNY，换算只发生在 `money()` 内部。**
所有累加逻辑（`reduce`）继续使用 CNY 原值，`money(cnyValue, currency)` 内部完成换算 + 取整 + 加符号。
- 备选：为每件商品配多套定价 → 数据维护成本高、易漂移，且与"固定汇率"目标矛盾。
- 备选：在状态层存换算后金额 → 切换货币要重算整棵购物车状态，侵入 reducer。
- 选择理由：改动面最小且集中，展示组件签名不变。

**决策 2：汇率与精度以 CNY 为基准的常量表。**
在 `utils.ts` 定义 `rates: Record<Currency, number>`（CNY=1，其余为经验近似固定值）与精度表 `fractionDigits: Record<Currency, number>`（CNY/USD/EUR/HKD=2，JPY/TWD=0）。`money()` 用 `Intl.NumberFormat` 按 `fractionDigits` 格式化，符号用 `currencySymbol` 表。
- 备选：用 `Intl.NumberFormat` 的 `style:'currency'` 自动定小数位 → 符号/位数受 locale 影响不可控，且无法表达"固定汇率"，故仅用其数字格式化能力。

**决策 3：总价先累加 CNY 再一次性换算（方案 X）。**
`money(subtotal_cny, currency)` 对累加结果单次取整；逐项 `money(item.price*qty, currency)` 各自独立换算。接受"逐项之和 vs 总价"最小单位级差异。
- 备选：逐项换算取整后相加（方案 Y）→ 累积误差更明显，且与逐项展示口径不统一。

**决策 4：货币状态由二态改多值。**
`toggle()` 废弃，改 `setCurrency(next: Currency)`；`getInitialCurrency` 的校验从 `stored==='CNY'||'USD'` 扩展为对六种货币集合的 `includes` 判断，非法/旧值降级为 CNY。
- 兼容性：既有持久化值 `'CNY'`/`'USD'` 仍合法，无需迁移。

**决策 5：切换 UI 改下拉菜单。**
复用 TopBar 现有主题 popover 的交互模式（按钮 + 点击外部关闭 + `role="menu"`/`menuitemradio`），列出六币种。触发器展示当前货币符号。文案（下拉标签、aria）走 i18next 补 zh/en。

## Risks / Trade-offs

- 逐项金额之和与总价可能差最小货币单位 → 多币种固有现象，spec 已声明可接受；如需强一致可后续增加"尾差归入总价"策略，本次不做。
- 固定汇率与真实汇率偏离 → demo 定位可接受；汇率集中在单一常量表，后续调整成本低。
- JPY/TWD 取整后小额商品可能显示相同整数值 → 属预期，源于零位小数精度。
- 下拉菜单挤占 TopBar 横向空间（原为单符号按钮）→ 复用既有 popover 收纳选项，触发器仍是单按钮宽度。

## Migration Plan

- 纯前端改动，无数据迁移；发布即生效。
- 回滚：还原 `utils.ts`/状态 hooks/TopBar/i18n 即可，`localStorage` 旧值兼容不受影响。
