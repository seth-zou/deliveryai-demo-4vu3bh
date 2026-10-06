# 多币种验收记录

日期：2026-10-06。集成分支：`feat/multi-currency`。最终功能提交：`37d07a1a2636a3dfd76c6693e70a4b21f03d6b94`；后续文档提交仅关闭规格和补全验收记录。

## 交付行为

顶部独立选择 CNY、USD、EUR、HKD，默认 CNY，本浏览器保留偏好。语言、RESET 不改变偏好，非法值和存储失败均有降级。菜单、半份规格、购物车、订单、券与优惠、结账、支付成功和 AI 确定性金额均使用统一报价。

固定演示比例为 1 CNY = 0.14 USD / 0.13 EUR / 1.10 HKD。明细逐行换算并舍入，展示小计按行相加，优惠独立换算，展示应付为两者之差。人民币定价与满200减20规则保持；人民币实际支付和支付时明细独立保存，切换币种或后续追加订单不修改首笔实付。

AI 每轮固定发送时币种，工具加购保存人民币价格，历史标签保留当时币种；新轮使用新选择。共享购物车转换同时用于页面 reducer 与两端适配器，汇率提示由共享常量插值。

## 测试入口与结果

用户确认的三个入口均已覆盖，票据 Comments 保留红绿证据。

| 验证 | 结果 | 覆盖 |
| --- | --- | --- |
| 服务端 `npm --prefix server test` | 36 passed | 6 个公开金额测试与 30 个既有服务端测试；逐行舍入、优惠边界、格式、非法币种、半份 |
| 最终集成 `npm run test:ai-currency` | 12 passed | 两端上下文、工具金额、人民币加购、连续工具轮、每轮币种、共享 reducer 加购/减量/移除 |
| 功能版本 `13777f2` 完整 Playwright | 72 passed / 1 failed，73 总计 | 新增 9 个币种/AI页面用例和全部 64 个既有用例；失败项见下文 |
| 最终 `37d07a1` Playwright 专项 | 12 passed | `ai-currency.spec.ts` 2 个、`multi-currency.spec.ts` 7 个、`auto-discount.spec.ts` 3 个；覆盖最后共享规则与汇率插值 |
| 前端 build、全量 lint、服务端 typecheck/build | 全部通过 | 集成构建、类型、静态检查；编译产物加载 harness 配置、共享金额和购物车模块成功 |

浏览器采用本机 Playwright headless Chromium。完整回归命令为 `npx playwright test`；最终专项命令为 `npx playwright test e2e/ai-currency.spec.ts e2e/multi-currency.spec.ts e2e/auto-discount.spec.ts`，均设置 `PLAYWRIGHT_CHROMIUM_PATH`。

初次启动完整回归时，共用依赖缓存导致本地 Vite 加载重复 React，页面空白。退出预览并使用 `npm run dev -- --port 5173 --strictPort --force` 重建后恢复，随后完成上述回归。没有为此修改产品代码。

## 既有失败与验收边界

完整回归的唯一失败是 `e2e/super-spicy.spec.ts:84` 的 `REQ-004.2`：点击风险提示遮罩后，规格弹层也消失，随后第100行找不到“微辣”按钮。基线 `381bcad7dc06f868baa19b38e4fc7c7ef03800fe` 在独立5176端口和独立 Vite 缓存下运行同一原始用例，同样失败（1 failed，13.6s）。原测试、MenuView 与 DialogContent 的基线 Git blob 均一致，隔离调整仅涉及端口、origin、服务复用与缓存目录。它是本次币种之前的既有问题；本需求明确排除无关订单流程修复，未改变此逻辑或弱化断言。

精简基线证据位于本地 `e2e-report/super-spicy-baseline.md`，完整回归报告保存在 `e2e-report/full-regression-html/`。验收图片和报告为忽略的本地产物。

AI 使用 mock SSE / 工具请求及无凭证交互验收；两个既有名称带 REAL 的测试未配置真实模型凭证，其通过不代表真实模型 API 连通。兑换比例为固定演示值，支付仍为模拟流程。

## Standards

首轮审查没有文档标准硬性违规，发现两个 P3 维护性判断：两端适配器与 reducer 的购物车变更重复、双语汇率提示重复固定数字。单个实现代理在 `7d74701` 中提取共享纯购物车转换并使用 `DEMO_RATES` 插值，补公开接口协同回归。独立 Standards 复核确认两个问题均已解决，未发现新项。

## Spec

独立 Spec 审查核对规格12项验收，未发现缺失、范围外实现或错误。最后整理提交复核通过，人民币价格、半份、优惠、逐行报价、每轮币种语义保持。

审查未解决项：Standards 0（首轮2项已修复），Spec 0。
