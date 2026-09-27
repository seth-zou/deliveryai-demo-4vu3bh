# Handoff 文档：智能点单助理

## 1. 功能概述

在沸点火锅点单演示产品中新增「智能点单助理」功能，提供 AI 助理浮窗入口，用户通过自然语言对话完成菜单浏览、智能推荐与购物车加购/改量/删除。

## 2. 架构边界

```
浏览器 (React SPA)
  ↕ HTTP/SSE
产品服务端 (Express :3001)
  ↕ HTTPS
HarnessRouter Cloud (api.harnessrouter.ai)
```

- **浏览器前端**：UI 界面、对话交互、SSE 流式接收、tool action 分发到 orderReducer
- **产品服务端**：HarnessRouter 适配器、API Key 保管、SSE 转发、tool call 执行、Session 管理
- **HarnessRouter Cloud**：Agent 运行时、模型调用、Trace 追踪

**安全要求**：API Key 仅通过服务端环境变量 `HARNESSROUTER_API_KEY` 读取，前端零接触。

## 3. HarnessRouter 配置

### 3.1 Workspace 和 Harness 信息

| 属性 | 值 |
|------|------|
| Workspace ID | `org.zoumzlzoumzl.gmail.com__hr_default` |
| Harness ID | `chrn_68f0b1eb42e0423ca54783ab9a73eb98` |
| Harness Name | `Smart Order Assistant` |
| Base | `codex` |
| Default Model | `gpt-5.4-mini` |
| Feature Key | `smart_order_assistant` |

### 3.2 功能映射关系

| Feature Key | Harness ID | 功能 |
|-------------|-----------|------|
| `smart_order_assistant` | `chrn_68f0b1eb42e0423ca54783ab9a73eb98` | 智能点单助理 |

### 3.3 配置文件位置

- **Harness 配置文件**：`server/harnesses/smart-order-assistant.json`
- **环境变量模板**：`server/.env.example`
- **环境变量文件**：`server/.env`（gitignored，不提交）

### 3.4 Agent Tools（6 个）

| Tool 名称 | 用途 |
|-----------|------|
| `search_menu` | 按关键词搜索菜品 |
| `get_menu_by_category` | 按分类获取菜品 |
| `get_product_detail` | 获取菜品详情（含规格选项） |
| `add_to_cart` | 将菜品加入购物车（→ ADD_CART action） |
| `update_cart_quantity` | 修改购物车数量（→ CHANGE_QTY action） |
| `get_cart` | 获取当前购物车内容 |

## 4. 代码文件清单

### 4.1 服务端（`server/`）

| 文件 | 职责 |
|------|------|
| `server/src/harness-router.ts` | HarnessRouter 适配器：API 调用、SSE 解析、tool call 执行、Session 管理、取消操作 |
| `server/src/chat-routes.ts` | Express 对话路由：POST /api/chat、POST /api/chat/cancel、GET /api/chat/config |
| `server/src/index.ts` | Express 入口（更新：注册 /api 路由） |
| `server/harnesses/smart-order-assistant.json` | Harness 配置数据文件 |
| `server/.env.example` | 环境变量模板（不含真实 Key） |
| `server/src/__tests__/harness-router.test.ts` | 适配器单元测试（30 个用例） |

### 4.2 前端（`src/`）

| 文件 | 职责 |
|------|------|
| `src/components/AIAssistant.tsx` | AI 助理浮窗组件：悬浮按钮 + 对话面板 + 流式显示 + 错误处理 |
| `src/hooks/useAIAssistant.ts` | 对话状态管理 hook：SSE 接收、tool action 分发、取消/重试/清空 |
| `src/i18n.ts` | 新增 `ai.*` 双语文案 |
| `src/App.tsx` | 集成 AIAssistant 组件（菜单页和订单页显示，结账页隐藏） |

### 4.3 测试

| 文件 | 职责 |
|------|------|
| `server/src/__tests__/harness-router.test.ts` | 适配器单元测试（mock HarnessRouter API） |
| `e2e/ai-assistant.spec.ts` | E2E 验收测试（浮窗显示、面板交互、深色模式、业务不受影响） |

## 5. API 路由

### POST /api/chat

发送对话消息，通过 SSE 流式返回 AI 响应。

**请求体**：
```json
{
  "message": "推荐一个锅底",
  "feature_key": "smart_order_assistant",
  "previous_response_id": "resp_xxx",
  "context": {
    "products": [...],
    "cart": [...],
    "soldOut": ["p8"],
    "diners": ["姚乾", "林溪", "陈默"],
    "language": "zh"
  }
}
```

**响应**：SSE 事件流
- `event: text_delta` — AI 文本增量
- `event: tool_result` — Tool 执行结果（含前端 action）
- `event: done` — 完成事件（含 response_id 和 trace_url）
- `event: error` — 错误事件

### POST /api/chat/cancel

取消正在进行的 AI 响应。

### GET /api/chat/config

返回 harness 配置元信息（不含敏感信息）。

## 6. 环境配置

### 必需环境变量

| 变量名 | 用途 | 位置 |
|--------|------|------|
| `HARNESSROUTER_API_KEY` | HarnessRouter Cloud API Key | `server/.env` |
| `PORT` | 服务端端口（默认 3001） | 可选 |

### Provider Key（BYOK）

HarnessRouter Cloud 免费试用覆盖 Agent 工作和内存，但模型调用需要自带 Provider Key（BYOK）。

- `OPENAI_API_KEY` 由 HarnessRouter 运行时管理，不能通过 harness env 覆盖
- 需要在 HarnessRouter 控制台的 "Bring Your Own Key" 中配置 Provider Key

### 前端环境变量

| 变量名 | 用途 | 默认值 |
|--------|------|--------|
| `VITE_AI_SERVER_URL` | 产品服务端 URL | `http://localhost:3001` |

## 7. 启动方式

### 开发模式

```bash
# 1. 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env 填入 HARNESSROUTER_API_KEY

# 2. 启动服务端
cd server && npm run dev

# 3. 启动前端
cd .. && npm run dev
```

### 生产模式

```bash
# 服务端
cd server && npm run build && npm start

# 前端
npm run build
```

## 8. 后续扩展方式

### 8.1 新增 Harness

1. 通过 `POST /v1/harnesses` 创建新 Harness
2. 在 `server/harnesses/` 下创建新的 JSON 配置文件
3. 在 `harness-router.ts` 的 `FEATURE_HARNESS_MAP` 中添加映射
4. 前端新增对应的 feature_key 调用

### 8.2 修改 Tools/指令

1. 编辑 `server/harnesses/smart-order-assistant.json` 中的 `tools` 或 `system_prompt`
2. 如新增 tool，在 `harness-router.ts` 的 `executeToolCall` 函数中添加对应 handler
3. 重启服务端生效

### 8.3 切换模型

编辑 `server/harnesses/smart-order-assistant.json` 中的 `default_model` 字段。
可用模型列表通过 `GET /v1/models` 获取。

## 9. 已知限制

1. **Provider Key 未配置**：HarnessRouter Cloud 免费试用不含模型调用费用，需在控制台配置 BYOK Provider Key 才能进行真实 AI 对话。未配置时 API 返回 `billing_error`。
2. **E2E 真实对接测试跳过**：`e2e/ai-assistant.spec.ts` 中的完整 AI 对话路径测试标记为 `test.skip`，需配置 Provider Key 后移除 skip。
3. **无持久化**：对话会话通过 HarnessRouter Session 在服务端保持，不做产品侧数据库持久化或跨设备同步。
4. **匿名使用**：产品无认证体系，AI 助理沿用匿名状态。

## 10. 安全检查

- [x] API Key 仅通过 `HARNESSROUTER_API_KEY` 环境变量读取
- [x] `.env` 已加入 `.gitignore`
- [x] 前端代码中无 `sk-hr-` 前缀字符串
- [x] 服务端日志不记录 API Key
- [x] 浏览器不直接调用 `api.harnessrouter.ai`
- [x] `grep -r "sk-hr-" src/ e2e/` 无结果
