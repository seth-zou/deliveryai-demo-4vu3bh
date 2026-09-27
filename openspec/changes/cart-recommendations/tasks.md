# Tasks

## 1. 货币核心：类型、汇率、取整、格式化

- [x] 1.1 在 `src/lib/utils.ts` 扩展 `Currency` 类型为 `'CNY' | 'USD' | 'EUR' | 'JPY' | 'HKD' | 'TWD'`；验证：`npm run build` 类型检查通过
- [x] 1.2 在 `src/lib/utils.ts` 新增以 CNY 为基准的固定汇率表 `rates`（CNY=1，USD/EUR/JPY/HKD/TWD 取经验近似固定值）与精度表 `fractionDigits`（CNY/USD/EUR/HKD=2，JPY/TWD=0）；验证：六种货币键齐全，`npm run build` 通过
- [x] 1.3 重写 `money(value, currency)`：先按 `rates` 将 CNY 底价换算为目标货币，再用 `Intl.NumberFormat` 按 `fractionDigits[currency]` 取整，冠以对应符号（`¥`/`$`/`€`/`¥`(JPY)/`HK$`/`NT$`）；CNY 不换算；验证：`money(68,'USD')` 输出换算后金额而非 `$68.00`，`money(68,'JPY')`/`money(68,'TWD')` 为整数无小数

## 2. 货币状态：多值选择与兼容

- [x] 2.1 在 `src/hooks/currency-context.ts` 将 `CurrencyContextValue` 的 `toggle` 移除、保留/明确 `setCurrency(currency: Currency)`；验证：`npm run build` 通过，无残留 `toggle` 引用
- [x] 2.2 在 `src/hooks/useCurrency.tsx` 将 `getInitialCurrency` 校验改为对六种货币集合的 `includes` 判断（非法/旧值降级 CNY），移除 `toggle`，导出 `setCurrency`；持久化与 localStorage 不可用降级逻辑保持；验证：手动切换后刷新页面货币保持，禁用 localStorage 时切换仍即时生效不报错
- [x] 2.3 检查 `src/hooks/use-currency.ts` 消费钩子与新 context 形状一致；验证：`npm run build` 通过

## 3. 切换 UI：TopBar 下拉菜单

- [x] 3.1 在 `src/components/TopBar.tsx` 将 `¥/$` 二态按钮改为货币下拉菜单，复用现有主题 popover 交互（按钮触发 + 点击外部关闭 + `role="menu"`/`menuitemradio`），列出六币种并标记当前选中，触发器显示当前货币符号；`onToggleCurrency` 改为 `onSetCurrency(currency)`；验证：点击展开六项、选择后立即切换、当前项有选中标记
- [x] 3.2 在 `src/App.tsx` 将传入 TopBar 的 `onToggleCurrency`/`toggle` 改为 `onSetCurrency`/`setCurrency`；验证：`npm run build` 通过，切换后 `App.tsx:169` 顶栏购物车金额随之换算

## 4. 国际化文案

- [x] 4.1 在 `src/i18n.ts` 为 zh 与 en 同步新增货币相关文案（下拉标题/各货币名称标签/`aria_currency` 等）；验证：`npm run lint`（--max-warnings 0）通过，中英文下拉标签均正确显示，无硬编码文本

## 5. 集成验收（E2E）

- [x] 5.1 在 `e2e/` 新增货币 spec，覆盖：切换六种货币后菜单/购物车/订单/结账/顶栏价格一致更新；断言 JPY/TWD 为整数、CNY/USD/EUR/HKD 为两位小数；断言总价为"先累加 CNY 再换算"（与逐项独立换算口径）；验证：`npx playwright test` 该 spec 全绿
