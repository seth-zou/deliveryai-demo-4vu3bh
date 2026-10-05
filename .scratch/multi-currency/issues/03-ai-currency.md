# 03: AI 金额和消息币种适配

**What to build:** 在实际前端AI请求及服务端工具输出中传递展示币种，金额规则与页面一致；每轮和历史消息保留当时币种，加购存储人民币。

**Blocked by:** 01: 统一多币种报价和支付快照

**Status:** resolved

- [x] 上下文与工具输出明确人民币原价和外币参考
- [x] 报价合计使用共享金额模块
- [x] 历史、在途回复、新轮次币种符合规格
- [x] AI 公开工具测试先失败后通过，现有加购回归通过

## Comments

2026-10-06：AI agent 已领取。用户确认的公开测试入口为 AI 工具输出/加购及页面流程。先通过公开 adapter 接口验证逐行参考金额与人民币定价，再验证 mock SSE 中的在途切换、历史标识及新轮次币种。

2026-10-06：阶段验证完成：公开工具/请求边界测试 10/10 通过（先红后绿，含逐行舍入、CNY半份加购、调用者切币种、连续工具轮和旧 response ID）；CNY消息标识页面测试 1/1 通过（节点缺失红测试后实现）；既有 AI 页面/代理 mock 回归 19/19 通过。此回归中的两个原名 REAL 用例未配置真实凭证，验到无 Key 错误/继续交互，不作为真实模型连通证据。前端构建、服务端 36 测试与 typecheck、改动文件 ESLint、diff检查均通过。已写 USD在途→EUR新轮次/历史标识 E2E，待页面币种入口合入后执行；ticket 保持 claimed。

## Answer

已完成前端 hook/实际 adapter 与服务端 adapter 的币种适配。上下文包含展示币种、固定演示汇率和 CNY 定价/结算基准；菜单、详情、购物车、加购的确定性工具输出明确人民币原价与外币参考。购物车使用共享 quoteAmounts/formatMinor，半份使用共享 portionPrice，action 的 price 始终为人民币元。

每次发送捕获本轮币种；后续工具请求重建本轮购物车上下文但保持该币种。请求 metadata 与 instructions 每轮带币种，旧 previous_response_id 不覆盖新轮币种。消息原文保留，并显示当时币种代码；币种切换不会清空或 abort 对话。服务端未提供 currency 的旧调用兼容 CNY。

本需求测试同时发现并最小修正了服务端既有连续工具轮问题：follow-up 再次返回 get_cart 等工具时，旧循环会重发原用户文本而丢弃工具输出；现在执行工具并转发 function_call_output，同时携带本轮 instructions。未替换整个服务端循环。

### 验收证据

- npm run test:ai-currency：10 passed。两端公开接口覆盖 USD 三行 ¥0.05 → USD 0.03 / CNY ¥0.15、菜单参考金额、半份 action CNY24、调用者在途切币种不影响本轮、工具加购后的共享报价、旧响应链的新币种及连续工具轮。每个实现切片均先记录对应红测试再通过。
- npm run build：通过；server npm test：36 passed；server npm run typecheck：通过；全部本票改动 TS/TSX 与测试 ESLint 通过。
- 原有 e2e/ai-assistant.spec.ts 与 e2e/ai-direct-api.spec.ts：19 passed (1.8m)，覆盖加购、售罄、错误/重试及页面交互。两个原名 REAL 用例未配置真实凭证，只覆盖无 Key 错误/继续交互，不代表真实模型连通。
- 合入最终集成分支 ac1afef 后，PLAYWRIGHT_PORT=5175、配置本机 headless Chromium，npx playwright test e2e/ai-currency.spec.ts --reporter=list：2 passed (11.6s)。覆盖默认 CNY 可见消息标签、USD 首请求在途切 EUR、不打断请求、半份工具仍报价 USD3.36/CNY24、复用 resp_usd 的新轮为 EUR3.12、HKD/CNY 切换后历史 USD/EUR 标签不变以及页面人民币加购价。首跑仅发现测试将实际“停止”按钮误写为“停止生成”，修正 locator 后通过，未改应用行为。

前期实现提交为 0f4cd59；本次补提交仅含最终 E2E locator 和工单验收。未推送、未创建 PR、未合并到集成分支。
