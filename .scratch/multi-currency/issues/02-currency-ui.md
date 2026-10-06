# 02: 全流程页面币种选择与金额展示

**What to build:** 让用户在顶部切换并记忆币种，全流程页面和券/优惠文案响应，结账及成功页人民币真实金额与外币参考金额清晰。

**Blocked by:** 01: 统一多币种报价和支付快照

**Status:** resolved

- [x] 手机/电脑、中文/英文、深色/老人模式可访问
- [x] 币种记忆与语言、RESET 独立，存储异常降级
- [x] 所有金额及移动端购物车按钮使用领域报价
- [x] 页面支付流程测试先失败后通过，现有优惠规则回归通过

## Answer

2026-10-06：顶部原生、带可访问标签的币种选择支持 CNY/USD/EUR/HKD；浏览器偏好独立于订单、语言及 RESET，非法值回退 CNY，存储拒绝读写仍在内存中可用。中英、深色及老人模式文案完整，窄屏汇率提示换行，桌面滚动区留出顶部偏移，移动订单/结账留出底部导航空间。

菜单卡片与半份规格、购物车明细/小计/移动入口、订单、会员券和优惠参考文案使用 shared/currency；结账同时显示参考小计、优惠、参考应付与人民币实际应付，确认支付按钮始终人民币。成功页使用 paymentSnapshot 的人民币实付和明细，后续币种切换及追加订单不改写实付结果。App 显式将 currency 传入 AI，AI 文件由票 03 负责。

### 验收证据

用户已确认的页面点餐到支付公开入口进行 TDD；e2e/multi-currency.spec.ts 共 7 个用例，全部通过，覆盖四币种、217→197 人民币优惠及 USD 30.38/2.80/27.58 参考金额、支付快照、半份 CNY24/USD3.36、会员券 USD4.20、持久化/语言/RESET、非法值、Storage 系统边界异常、320px 英文深色老人模式键盘选择与浮动购物车视口边界。

红→绿记录：
- 币种入口测试先因 combobox 不存在失败，最小入口/菜单实现后通过。
- 全流程测试先因购物车仍显示 ¥217.00 而非 USD30.38 失败，报价与支付快照接入后通过。
- 半份弹层先仍显示 USD5.88 而非 USD3.36 失败，统一 portionPrice 后通过；窄屏流程暴露固定底部导航遮挡结账按钮，留白修复后通过。

验证命令：配置独立 PLAYWRIGHT_PORT=5174 与本机 headless Chromium，运行 npx playwright test e2e/multi-currency.spec.ts e2e/auto-discount.spec.ts e2e/dark-mode.spec.ts --reporter=list，29 passed (2.5m)。最终新增的 320px 加购浮动购物车边界及与 AI 入口非重叠断言单独复核 1 passed；截图复核后采用左右留白居中胶囊并上移至 AI 入口上方，避免遮挡金额；移动菜单 pb-64 为上移后的浮动区留出足够滚动空间，最后一排可完整移到浮动区上方。合入 feat/multi-currency 6181d19 后 npm run build 与本票源文件/e2e eslint --max-warnings 0 全部通过。

截图：工作树 e2e-report/currency-mobile-dark-elderly.png（忽略的验收产物，未提交）。未推送、未创建 PR、未合并集成分支。
