/**
 * HarnessRouter Cloud Adapter
 *
 * 产品服务端通过此适配器调用 HarnessRouter Cloud API（UHP 模式），
 * 实现 AI Agent 能力。浏览器前端不直接调用 HarnessRouter API。
 *
 * 安全要求：API Key 优先从前端请求 Header 读取（演示用途），fallback 到环境变量 HARNESSROUTER_API_KEY。
 * 前端明文存储仅限演示场景，不适用于生产环境。
 */

import { DEMO_RATES, portionPrice, formatMoney, formatMinor, normalizeCurrency, quoteAmounts, type CurrencyCode } from '../../shared/currency.js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const HARNESSROUTER_BASE_URL = process.env.HARNESSROUTER_BASE_URL || 'https://api.harnessrouter.ai'

function getApiKey(externalKey?: string): string {
  // 前端传入的 Key 优先（演示用途），fallback 到服务端环境变量
  if (externalKey) return externalKey
  return process.env.HARNESSROUTER_API_KEY || ''
}


// ── 类型定义 ──────────────────────────────────────────────

export interface ToolDefinition {
  type: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ProductContext {
  id: string
  name: string
  description: string
  category: string
  price: number
  options?: {
    portion?: string[]
    flavor?: string[]
    spicy?: string[]
  }
}

export interface CartItemContext {
  uid: string
  productId: string
  name: string
  price: number
  quantity: number
  spec: string
  orderedBy: string
}

/** 前端传递给服务端的产品上下文 */
export interface ProductStateContext {
  products: ProductContext[]
  cart: CartItemContext[]
  soldOut: string[]
  diners: string[]
  language: string
  currency?: CurrencyCode
  pricingCurrency?: 'CNY'
  demoRates?: typeof DEMO_RATES
}

/** 服务端返回给前端的 tool 执行结果中的前端 action */
export interface FrontendAction {
  type: 'ADD_CART' | 'CHANGE_QTY'
  payload: Record<string, unknown>
}

/** SSE 事件推送给前端的格式 */
export interface SSEEvent {
  event: 'text_delta' | 'tool_result' | 'done' | 'error'
  data: Record<string, unknown>
}

/** tool call handler 执行结果 */
export interface ToolCallResult {
  output: string
  action?: FrontendAction
}

export type ToolCallHandler = (
  toolName: string,
  args: Record<string, unknown>,
  context: ProductStateContext
) => ToolCallResult

// ── Harness 配置加载 ──────────────────────────────────────

interface HarnessConfig {
  feature_key: string
  harness_id: string
  workspace_id: string
  name: string
  base: string
  default_model: string
  system_prompt: string
  tools: ToolDefinition[]
}

let _harnessConfig: HarnessConfig | null = null

function loadHarnessConfig(): HarnessConfig {
  if (_harnessConfig) return _harnessConfig
  const configPath = resolve(__dirname, '../harnesses/smart-order-assistant.json')
  const raw = readFileSync(configPath, 'utf-8')
  _harnessConfig = JSON.parse(raw) as HarnessConfig
  return _harnessConfig
}

/** feature_key → harness_id 映射 */
const FEATURE_HARNESS_MAP: Record<string, string> = {}

export function getHarnessId(featureKey: string): string {
  if (FEATURE_HARNESS_MAP[featureKey]) return FEATURE_HARNESS_MAP[featureKey]
  const config = loadHarnessConfig()
  if (config.feature_key === featureKey) {
    FEATURE_HARNESS_MAP[featureKey] = config.harness_id
    return config.harness_id
  }
  throw new Error(`Unknown feature_key: ${featureKey}`)
}

export function getHarnessConfig(): HarnessConfig {
  return loadHarnessConfig()
}

// ── 工具定义 ──────────────────────────────────────────────

export function getToolDefinitions(): ToolDefinition[] {
  return loadHarnessConfig().tools
}

// ── 系统指令构建 ──────────────────────────────────────────

function describePrice(cnyPrice: number, currency: CurrencyCode): string {
  return `人民币原价 CNY ${formatMoney(cnyPrice)}${currency === 'CNY' ? '' : `；参考 ${formatMoney(cnyPrice, currency)}（演示汇率，仅供参考）`}`
}

export function buildSystemInstructions(context: ProductStateContext): string {
  const currency = normalizeCurrency(context.currency)
  const config = loadHarnessConfig()
  const productList = context.products
    .map((p) => {
      const opts = []
      if (p.options?.portion?.length) opts.push(`份量: ${p.options.portion.join('/')}`)
      if (p.options?.flavor?.length) opts.push(`口味: ${p.options.flavor.join('/')}`)
      if (p.options?.spicy?.length) opts.push(`辣度: ${p.options.spicy.join('/')}`)
      const optStr = opts.length ? ` [${opts.join(', ')}]` : ''
      const soldOut = context.soldOut.includes(p.id) ? ' (已售罄)' : ''
      return `- ${p.id}: ${p.name} - ${p.description} ${describePrice(p.price, currency)} 分类:${p.category}${optStr}${soldOut}`
    })
    .join('\n')

  const cartList = context.cart.length ? executeToolCall('get_cart', {}, context).output : '(空)'

  const langInstruction = context.language === 'en'
    ? 'Respond in English.'
    : '请用中文回复。'

  return `${config.system_prompt}

Display currency: ${currency}
定价与结算币种: CNY；所有 price 字段为人民币元，加购不得写入外币。
演示汇率（固定，仅供参考）: 1 CNY = ${DEMO_RATES.USD.toFixed(2)} USD, ${DEMO_RATES.EUR.toFixed(2)} EUR, ${DEMO_RATES.HKD.toFixed(2)} HKD
本轮所有回复和工具沿用 ${currency}，外币金额为参考换算；以本轮指令为准，覆盖旧轮次币种。

当前菜单数据：
${productList}

当前购物车状态：
${cartList}

当前桌台用餐人: ${context.diners.join(', ')}
售罄菜品ID: ${context.soldOut.join(', ') || '无'}

注意事项：
- 加购时默认下单人为 ${context.diners[0] || '未知'}
- 售罄菜品不可加购，需告知用户并推荐替代
- 仅可使用提供的 6 个工具操作，不可执行订单提交/支付/呼叫服务等操作
${langInstruction}`
}

// ── Tool Call Handler ─────────────────────────────────────

export function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context: ProductStateContext
): ToolCallResult {
  switch (toolName) {
    case 'search_menu': {
      const query = String(args.query || '').toLowerCase()
      const results = context.products.filter((p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      )
      if (!results.length) {
        return { output: `没有找到与"${args.query}"相关的菜品。` }
      }
      const list = results.map((p) => {
        const soldOut = context.soldOut.includes(p.id) ? ' [已售罄]' : ''
        return `${p.id}: ${p.name} - ${p.description} ${describePrice(p.price, normalizeCurrency(context.currency))}${soldOut}`
      }).join('\n')
      return { output: `搜索结果：\n${list}` }
    }

    case 'get_menu_by_category': {
      const category = String(args.category || '').toLowerCase()
      const results = context.products.filter((p) =>
        p.category.toLowerCase().includes(category) || category.includes(p.category.toLowerCase())
      )
      if (!results.length) {
        return { output: `分类"${args.category}"下没有找到菜品。` }
      }
      const list = results.map((p) => {
        const soldOut = context.soldOut.includes(p.id) ? ' [已售罄]' : ''
        return `${p.id}: ${p.name} - ${p.description} ${describePrice(p.price, normalizeCurrency(context.currency))}${soldOut}`
      }).join('\n')
      return { output: `分类菜品：\n${list}` }
    }

    case 'get_product_detail': {
      const productId = String(args.product_id || '')
      const product = context.products.find((p) => p.id === productId)
      if (!product) {
        return { output: `未找到菜品ID: ${productId}` }
      }
      const opts: string[] = []
      if (product.options?.portion?.length) opts.push(`份量: ${product.options.portion.join('/')}`)
      if (product.options?.flavor?.length) opts.push(`口味: ${product.options.flavor.join('/')}`)
      if (product.options?.spicy?.length) opts.push(`辣度: ${product.options.spicy.join('/')}`)
      const soldOut = context.soldOut.includes(product.id) ? ' [已售罄]' : ''
      return { output: `${product.id}: ${product.name} - ${product.description} ${describePrice(product.price, normalizeCurrency(context.currency))}${soldOut}\n可选规格: ${opts.join(', ') || '无'}` }
    }

    case 'add_to_cart': {
      const productId = String(args.product_id || '')
      const quantity = Number(args.quantity) || 1
      const product = context.products.find((p) => p.id === productId)
      if (!product) {
        return { output: `未找到菜品ID: ${productId}，无法加购。` }
      }
      if (context.soldOut.includes(productId)) {
        // 推荐替代菜品
        const alternatives = context.products
          .filter((p) => p.category === product.category && !context.soldOut.includes(p.id))
          .slice(0, 3)
        const altNames = alternatives.map((p) => p.name).join('、')
        return { output: `抱歉，${product.name}已售罄。${altNames ? `要不要试试：${altNames}？` : '请选择其他菜品。'}` }
      }
      const portion = String(args.portion || '')
      const flavor = String(args.flavor || '')
      const spicy = String(args.spicy || '')
      const specParts = [portion, flavor, spicy].filter(Boolean)
      const spec = specParts.length ? specParts.join(' · ') : '标准份'
      const price = portionPrice(product.price, portion.includes('半份') || portion.includes('Half'))
      const orderedBy = context.diners[0] || '未知'

      return {
        output: `已加入购物车：${product.name} · ${spec}（下单人：${orderedBy}）；${describePrice(price, normalizeCurrency(context.currency))}`,
        action: {
          type: 'ADD_CART',
          payload: {
            uid: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            productId: product.id,
            name: product.name,
            price,
            quantity,
            image: '',
            spec,
            orderedBy,
          },
        },
      }
    }

    case 'update_cart_quantity': {
      const uid = String(args.uid || '')
      const delta = Number(args.delta) || 0
      const item = context.cart.find((c) => c.uid === uid)
      if (!item) {
        return { output: `未找到购物车项 uid: ${uid}。当前购物车：\n${context.cart.map((c) => `${c.uid}: ${c.name} x${c.quantity}`).join('\n') || '(空)'}` }
      }
      const newQty = item.quantity + delta
      if (newQty <= 0) {
        return {
          output: `已移除：${item.name}`,
          action: {
            type: 'CHANGE_QTY',
            payload: { uid, delta: -item.quantity },
          },
        }
      }
      return {
        output: `已修改：${item.name} 数量改为 ${newQty}`,
        action: {
          type: 'CHANGE_QTY',
          payload: { uid, delta },
        },
      }
    }

    case 'get_cart': {
      if (!context.cart.length) {
        return { output: '当前购物车还是空的，告诉我你想吃什么吧！' }
      }
      const currency = normalizeCurrency(context.currency)
      const quote = quoteAmounts(context.cart, currency)
      const list = context.cart.map((c, index) =>
        `- ${c.uid}: ${c.name} x${c.quantity} 单价: 人民币 CNY ${formatMoney(c.price)}；行金额: 人民币 CNY ${formatMinor(quote.cny.lineAmounts[index])}${currency === 'CNY' ? '' : `；参考 ${formatMinor(quote.lineAmounts[index], currency)}`} 规格:${c.spec} 下单人:${c.orderedBy}`
      ).join('\n')
      return { output: `当前购物车：\n${list}\n合计: 人民币 CNY ${formatMinor(quote.cny.subtotal)}${currency === 'CNY' ? '' : `；参考 ${formatMinor(quote.subtotal, currency)}（演示汇率，仅供参考）`}` }
    }

    default:
      return { output: `未知工具: ${toolName}` }
  }
}

/** Keep this request's cart aligned with the actions sent to the order reducer. */
function applyToolAction(context: ProductStateContext, action?: FrontendAction): void {
  if (action?.type === 'ADD_CART') {
    const item = action.payload as unknown as CartItemContext
    const same = context.cart.find((c) => c.productId === item.productId && c.spec === item.spec && c.orderedBy === item.orderedBy)
    context.cart = same
      ? context.cart.map((c) => c.uid === same.uid ? { ...c, quantity: c.quantity + 1 } : c)
      : [...context.cart, item]
  } else if (action?.type === 'CHANGE_QTY') {
    context.cart = context.cart
      .map((c) => c.uid === action.payload.uid ? { ...c, quantity: c.quantity + Number(action.payload.delta) } : c)
      .filter((c) => c.quantity > 0)
  }
}

// ── SSE 解析工具 ──────────────────────────────────────────

interface SSEParsedEvent {
  event: string
  data: string
}

export function parseSSELine(line: string): SSEParsedEvent | null {
  if (!line.startsWith('data: ')) return null
  return { event: 'data', data: line.slice(6) }
}

// ── 核心调用函数 ──────────────────────────────────────────

export interface ChatOptions {
  message: string
  featureKey: string
  previousResponseId?: string
  context: ProductStateContext
  signal?: AbortSignal
  /** 前端传入的 API Key（演示用途），优先于环境变量 */
  apiKey?: string
  /** SSE 事件回调，每解析出一个事件调用一次 */
  onEvent: (event: SSEEvent) => void
}

/**
 * 调用 HarnessRouter Cloud API 进行对话。
 * 处理流式响应、tool call 执行和多轮调用。
 */
export async function chatWithHarness(opts: ChatOptions): Promise<{ responseId: string; traceUrl?: string }> {
  const apiKey = getApiKey(opts.apiKey)
  if (!apiKey) {
    throw new Error('请先配置 HARNESSROUTER_API_KEY')
  }

  const harnessId = getHarnessId(opts.featureKey)
  const config = loadHarnessConfig()
  // Currency is captured once before awaiting the external request.
  const context: ProductStateContext = {
    ...opts.context,
    currency: normalizeCurrency(opts.context.currency),
    cart: opts.context.cart.map((item) => ({ ...item })),
  }
  const tools = getToolDefinitions()

  let currentResponseId = opts.previousResponseId || ''
  let message: string | Array<Record<string, unknown>> = opts.message
  let needsToolCall = true
  let traceUrl: string | undefined

  while (needsToolCall) {
    const body: Record<string, unknown> = {
      model: config.default_model,
      metadata: { harness_id: harnessId, currency: context.currency },
      input: message,
      instructions: buildSystemInstructions(context),
      stream: true,
    }

    if (currentResponseId) {
      body.previous_response_id = currentResponseId
    }

    // 第一次请求带 tools，后续 tool 结果回传不需要带 tools
    if (!currentResponseId || needsToolCall) {
      body.tools = tools
    }

    const response = await fetch(`${HARNESSROUTER_BASE_URL}/v1/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`HarnessRouter API error ${response.status}: ${errorText}`)
    }

    if (!response.body) {
      throw new Error('HarnessRouter API returned no body')
    }

    // 解析 SSE 流
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''
    void fullText
    const functionCalls: Array<{ callId: string; name: string; arguments: string }> = []
    let responseId = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue

          const parsed = parseSSELine(trimmed)
          if (!parsed) continue

          let eventData: Record<string, unknown>
          try {
            eventData = JSON.parse(parsed.data)
          } catch {
            continue
          }

          const eventType = String(eventData.type || '')

          // 处理不同事件类型
          if (eventType === 'response.output_text.delta') {
            const delta = String(eventData.delta || '')
            fullText += delta
            opts.onEvent({ event: 'text_delta', data: { content: delta } })
          } else if (eventType === 'response.function_call_arguments.delta') {
            // 累积 function call 参数
            // 在 response.completed 中处理完整 function call
          } else if (eventType === 'response.output_item.added') {
            const item = eventData.item as Record<string, unknown> | undefined
            if (item && item.type === 'function_call') {
              functionCalls.push({
                callId: String(item.call_id || ''),
                name: String(item.name || ''),
                arguments: String(item.arguments || ''),
              })
            }
          } else if (eventType === 'response.completed') {
            const resp = eventData.response as Record<string, unknown> | undefined
            if (resp) {
              responseId = String(resp.id || '')
              // 提取 trace 信息
              const metadata = resp.metadata as Record<string, unknown> | undefined
              if (metadata?.trace_url) {
                traceUrl = String(metadata.trace_url)
              }
              // 也从 output items 中提取 function calls
              const output = resp.output as Array<Record<string, unknown>> | undefined
              if (output) {
                for (const item of output) {
                  if (item.type === 'function_call' && !functionCalls.find((fc) => fc.callId === String(item.call_id))) {
                    functionCalls.push({
                      callId: String(item.call_id || ''),
                      name: String(item.name || ''),
                      arguments: String(item.arguments || ''),
                    })
                  }
                }
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    currentResponseId = responseId || currentResponseId

    // 处理 tool calls
    if (functionCalls.length > 0) {
      needsToolCall = true
      // 执行每个 tool call
      const toolOutputs: Array<{ callId: string; output: string }> = []
      for (const fc of functionCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(fc.arguments || '{}')
        } catch {
          // 参数解析失败用空对象
        }
        const result = executeToolCall(fc.name, args, context)
        applyToolAction(context, result.action)
        toolOutputs.push({ callId: fc.callId, output: result.output })

        // 如果有前端 action，推送给前端
        if (result.action) {
          opts.onEvent({
            event: 'tool_result',
            data: {
              tool: fc.name,
              success: true,
              message: result.output,
              action: result.action,
            },
          })
        } else {
          opts.onEvent({
            event: 'tool_result',
            data: {
              tool: fc.name,
              success: true,
              message: result.output,
            },
          })
        }
      }

      // 发送 tool 结果回 HarnessRouter，继续对话
      // 使用 previous_response_id + function_call_output
      const followUpBody: Record<string, unknown> = {
        model: config.default_model,
        metadata: { harness_id: harnessId, currency: context.currency },
        previous_response_id: currentResponseId,
        input: toolOutputs.map((to) => ({
          type: 'function_call_output',
          call_id: to.callId,
          output: to.output,
        })),
        instructions: buildSystemInstructions(context),
        stream: true,
      }

      const followUpResponse = await fetch(`${HARNESSROUTER_BASE_URL}/v1/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(followUpBody),
        signal: opts.signal,
      })

      if (!followUpResponse.ok) {
        const errorText = await followUpResponse.text().catch(() => 'Unknown error')
        throw new Error(`HarnessRouter API follow-up error ${followUpResponse.status}: ${errorText}`)
      }

      if (!followUpResponse.body) {
        throw new Error('HarnessRouter API returned no body on follow-up')
      }

      // 解析 follow-up SSE 流
      const followUpReader = followUpResponse.body.getReader()
      const followUpDecoder = new TextDecoder()
      let followUpBuffer = ''
      let followUpText = ''
      void followUpText
      const followUpFunctionCalls: Array<{ callId: string; name: string; arguments: string }> = []
      let followUpResponseId = ''

      try {
        while (true) {
          const { done, value } = await followUpReader.read()
          if (done) break
          followUpBuffer += followUpDecoder.decode(value, { stream: true })

          const lines = followUpBuffer.split('\n')
          followUpBuffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith(':')) continue

            const parsed = parseSSELine(trimmed)
            if (!parsed) continue

            let eventData: Record<string, unknown>
            try {
              eventData = JSON.parse(parsed.data)
            } catch {
              continue
            }

            const eventType = String(eventData.type || '')

            if (eventType === 'response.output_text.delta') {
              const delta = String(eventData.delta || '')
              followUpText += delta
              opts.onEvent({ event: 'text_delta', data: { content: delta } })
            } else if (eventType === 'response.output_item.added') {
              const item = eventData.item as Record<string, unknown> | undefined
              if (item && item.type === 'function_call') {
                followUpFunctionCalls.push({
                  callId: String(item.call_id || ''),
                  name: String(item.name || ''),
                  arguments: String(item.arguments || ''),
                })
              }
            } else if (eventType === 'response.completed') {
              const resp = eventData.response as Record<string, unknown> | undefined
              if (resp) {
                followUpResponseId = String(resp.id || '')
                const metadata = resp.metadata as Record<string, unknown> | undefined
                if (metadata?.trace_url) {
                  traceUrl = String(metadata.trace_url)
                }
                const output = resp.output as Array<Record<string, unknown>> | undefined
                if (output) {
                  for (const item of output) {
                    if (item.type === 'function_call' && !followUpFunctionCalls.find((fc) => fc.callId === String(item.call_id))) {
                      followUpFunctionCalls.push({
                        callId: String(item.call_id || ''),
                        name: String(item.name || ''),
                        arguments: String(item.arguments || ''),
                      })
                    }
                  }
                }
              }
            }
          }
        }
      } finally {
        followUpReader.releaseLock()
      }

      currentResponseId = followUpResponseId || currentResponseId

      // 如果 follow-up 又有 tool calls，继续循环
      if (followUpFunctionCalls.length > 0) {
        // Return every follow-up tool's output using this turn's fixed currency.
        message = followUpFunctionCalls.map((fc) => {
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(fc.arguments || '{}')
          } catch {
            // Match the first tool round's invalid-argument fallback.
          }
          const result = executeToolCall(fc.name, args, context)
          applyToolAction(context, result.action)
          opts.onEvent({ event: 'tool_result', data: {
            tool: fc.name, success: true, message: result.output,
            ...(result.action ? { action: result.action } : {}),
          } })
          return { type: 'function_call_output', call_id: fc.callId, output: result.output }
        })
      } else {
        needsToolCall = false
      }
    } else {
      needsToolCall = false
    }
  }

  return { responseId: currentResponseId, traceUrl }
}

/**
 * 取消正在进行的 HarnessRouter 响应
 */
export async function cancelHarnessResponse(sessionId: string, apiKey?: string): Promise<void> {
  const key = getApiKey(apiKey)
  if (!key) {
    throw new Error('请先配置 HARNESSROUTER_API_KEY')
  }
  await fetch(`${HARNESSROUTER_BASE_URL}/v1/sessions/${encodeURIComponent(sessionId)}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  })
}
