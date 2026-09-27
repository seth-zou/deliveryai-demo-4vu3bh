# Proposal

## Why

当前应用虽然提供 CNY/USD 双币种切换，但 `money(value, currency)` 只替换货币符号、不做任何汇率换算——68 元在 USD 模式下直接显示为 `$68.00`，金额是"假"的。要真正支持多国货币，需要引入真实换算与按币种的取整规则，让价格展示、货币切换与总价展示在多种货币下都正确可信。

## What Changes

- **BREAKING** 扩展 `Currency` 类型：由 `'CNY' | 'USD'` 扩展为 `'CNY' | 'USD' | 'EUR' | 'JPY' | 'HKD' | 'TWD'` 六种货币（新增新台币 TWD）。
- 引入固定汇率表（以 CNY 为基准货币，按经验取近似固定值），在展示层将 CNY 底价换算为目标货币。
- `money(value, currency)` 改为"先换算，再按币种精度取整"：CNY/USD/EUR/HKD 保留 2 位小数，JPY/TWD 取 0 位小数（新台币零售辅币已不流通，按整数展示）。
- 采用**底价 CNY** 策略：`menu.ts` 商品定价与所有小计/总价累加逻辑保持 CNY 原值不变，换算只发生在展示层 `money()` 内部。
- **总价换算顺序**采用"先累加 CNY 原值、再一次性换算"（方案 X），避免逐项取整的累积误差；已知副作用：逐项金额之和可能与总价存在 1 分钱差异，属多币种固有现象，可接受。
- 货币切换 UI 由 TopBar 的 `¥/$` 二态按钮 + `toggle()` 改为**下拉菜单**（复用现有主题 popover 交互模式），改用 `setCurrency`；`toggle()` 二态语义废弃。
- 结账满减阈值（`subtotal >= 100 ? 30`）作为 CNY 层规则保持不变。
- 新增货币相关 i18n 文案（下拉标签、aria 等），zh/en 同步补齐。

## Capabilities

### New Capabilities
- `multi-currency-pricing`: 多国货币（CNY/USD/EUR/JPY/HKD/TWD）的价格展示、货币切换与总价换算能力，涵盖固定汇率换算、按币种取整、底价 CNY 累加策略，以及菜单/购物车/订单/结账/顶栏各价格展示位置的一致行为。

### Modified Capabilities
<!-- 项目当前无既有 spec（openspec list --specs 返回 No specs found），故无需修改既有能力。 -->

## Impact

- **类型/工具**：`src/lib/utils.ts`（`Currency` 类型、`money()`、新增汇率表与精度表）。
- **货币状态**：`src/hooks/currency-context.ts`、`useCurrency.tsx`、`use-currency.ts`（去二态 `toggle`，改为多值 `setCurrency`，`getInitialCurrency` 校验扩展）。
- **切换 UI**：`src/components/TopBar.tsx`（币种下拉菜单）。
- **价格展示页面**：`MenuView.tsx`、`CartPanel.tsx`、`OrderView.tsx`、`CheckoutView.tsx`、`App.tsx`（`money()` 调用签名不变，随类型扩展自动适配）。
- **国际化**：`src/i18n.ts`（新增货币相关 zh/en 文案）。
- **测试**：E2E 币种切换用例需覆盖五种货币与换算/取整断言。
- **数据层**：`src/data/menu.ts` 保持 CNY 原值，不改动。
