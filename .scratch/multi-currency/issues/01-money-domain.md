# 01: 统一多币种报价和支付快照

**What to build:** 实现公开金额模块并通过金额报价入口验证，人民币计价/优惠保持稳定，逐行外币报价严格可加；记录支付金额与订单明细快照。

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] 支持四币种及固定演示值，非法币种可回退
- [x] 逐行舍入、小计、优惠、应付遵守规格
- [x] 支付快照不随后续订单变化而改变
- [x] 金额报价测试先失败后通过，服务端类型检查可用

## Comments

2026-10-06：遵照已批准测试入口，先从公开 `quoteAmounts` 写逐行舍入示例：三行 ¥0.04 的 USD 展示各为 1 美分、小计 3 美分。首次执行因金额模块不存在而失败（ERR_MODULE_NOT_FOUND）；最小实现后通过。满200减20用例随后先失败（实际 discount=0，期望 USD 280 美分 / CNY 2000 分），实现人民币门槛与独立优惠换算后通过。格式化/非法币种和半份报价分别先因缺少公开导出失败，再实现后通过。测试期望使用手工示例值。

金额共享 API 位于 `shared/currency.ts`：`CurrencyCode`、`CURRENCIES`、`DEMO_RATES`、`isCurrencyCode`、`normalizeCurrency`、`formatMoney`、`formatMinor`、`portionPrice`、`quoteAmounts`。报价输入价格为人民币元，全部报价输出（含 `cny`）为整数最小单位；`formatMinor` 不重复换算；`formatMoney` 接收人民币元。优惠仅在 `applyDiscount=true` 时按人民币小计满200减20。

首次 PAY 保存 `paymentSnapshot: { items, paidCny }`，明细逐项复制、实付以人民币元保存；后续履约、加单和重复 PAY 不覆盖首笔快照，RESET 清空。执行状态冒烟验证人民币200元订单实付180元、明细引用独立、履约后快照保持 submitted、后续订单再次 PAY 保留180元、RESET 快照为 null。页面消费快照和币种切换验证交由 UI 票既定页面入口覆盖。

验证：服务端36测试通过（6金额 + 30既有）、`npm run typecheck` 与 `npm run build` 通过；根 `npm run build`、`npm run lint` 通过。服务端 rootDir 改为仓库根以编译共享模块，start 使用 `dist/server/src/index.js`；build 同时复制 harness 配置。编译后 `getHarnessConfig()` 与 `formatMoney(42,'USD')` 返回 `smart_order_assistant` / `USD 5.88`，`PORT=3107 npm start` 后 `/ping` 返回 pong。
