# 多币种实现任务图

## Notes

规格：[spec.md](spec.md)。测试入口由用户确认：公开金额报价、点餐到支付页面、AI 工具输出与加购。

## Decisions-so-far

- [01 金额领域与支付快照](issues/01-money-domain.md)：resolved；统一整数报价、人民币优惠与支付时快照，是后续页面及 AI 票据的依赖。
- [02 页面币种选择](issues/02-currency-ui.md)：resolved；顶部入口、本浏览器偏好、四币种金额、人民币实付及移动端布局已合入。
- [03 AI 币种适配](issues/03-ai-currency.md)：resolved；锁定每轮币种、保留历史标识、工具保存人民币价格；审查后共享购物车规则和汇率文案数据。
- 集成分支：`feat/multi-currency`；实现与验证见 [verification.md](verification.md)。

## Fog

无待确认的多币种决策。实时汇率、真实支付和真实模型 API 连通不属于本次验收。
