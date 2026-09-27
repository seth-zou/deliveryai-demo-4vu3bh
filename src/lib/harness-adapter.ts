/**
 * HarnessRouter Cloud 适配器（前端版）
 *
 * 从 server/src/harness-router.ts 迁移到前端模块。
 * 负责系统指令构建、tool call 执行、SSE 解析和多轮 tool call 循环。
 * 使用浏览器原生 fetch + ReadableStream，不依赖 Node.js 模块。
 */

import { harnessConfig, type ToolDefinition } from '@/data/harness-config'

// ── 类型定义 ──────────────────────────────────────────────

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

/** 前端传递的产品上下文 */
export interface ProductStateContext {
  products: ProductContext[]
  cart: CartItemContext[]
  soldOut: string[]
  diners: string[]
  language: string
}

/** tool call handler 执行结果中的前端 action */
export interface FrontendAction {
  type: 'ADD_CART' | 'CHANGE_QTY'
  payload: Record<string, unknown>
}

/** SSE 事件回调格式 */
export interface SSEEvent {
  event: 'text_delta' | 'tool_result' | 'done' | 'error'
  data: Record<string, unknown>
}

/** tool call handler 执行结果 */
export interface ToolCallResult {
  output: string
  action?: FrontendAction
}

const HARNESSROUTER_BASE_URL = 'https://api.harnessrouter.ai'

// ── 工具定义 ──────────────────────────────────────────────

export function getToolDefinitions(): ToolDefinition[] {
  return harnessConfig.tools
}

// ── 系统指令构建 ──────────────────────────────────────────

export function buildSystemInstructions(context: ProductStateContext): string {
  const productList = context.products
    .map((p) => {
      const opts: string[] = []
      if (p.options?.portion?.length) opts.push(`份量: ${p.options.portion.join('/')}`)
      if (p.options?.flavor?.length) opts.push(`口味: ${p.options.flavor.join('/')}`)
      if (p.options?.spicy?.length) opts.push(`辣度: ${p.options.spicy.join('/')}`)
      const optStr = opts.length ? ` [${opts.join(', ')}]` : ''
      const soldOut = context.soldOut.includes(p.id) ? ' (已售罄)' : ''
      return `- ${p.id}: ${p.name} - ${p.description} ¥${p.price} 分类:${p.category}${optStr}${soldOut}`
    })
    .join('\n')

  const cartList = context.cart.length
    ? context.cart
        .map((c) => `- uid:${c.uid} ${c.name} x${c.quantity} ¥${c.price} 规格:${c.spec} 下单人:${c.orderedBy}`)
        .join('\n')
    : '(空)'

  const langInstruction =
    context.language === 'en' ? 'Respond in English.' : '请用中文回复。'

  return `${harnessConfig.system_prompt}

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
      const results = context.products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query)
      )
      if (!results.length) {
        return { output: `没有找到与"${args.query}"相关的菜品。` }
      }
      const list = results
        .map((p) => {
          const soldOut = context.soldOut.includes(p.id) ? ' [已售罄]' : ''
          return `${p.id}: ${p.name} - ${p.description} ¥${p.price}${soldOut}`
        })
        .join('\n')
      return { output: `搜索结果：\n${list}` }
    }

    case 'get_menu_by_category': {
      const category = String(args.category || '').toLowerCase()
      const results = context.products.filter(
        (p) =>
          p.category.toLowerCase().includes(category) ||
          category.includes(p.category.toLowerCase())
      )
      if (!results.length) {
        return { output: `分类"${args.category}"下没有找到菜品。` }
      }
      const list = results
        .map((p) => {
          const soldOut = context.soldOut.includes(p.id) ? ' [已售罄]' : ''
          return `${p.id}: ${p.name} - ${p.description} ¥${p.price}${soldOut}`
        })
        .join('\n')
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
      return {
        output: `${product.id}: ${product.name} - ${product.description} ¥${product.price}${soldOut}\n可选规格: ${opts.join(', ') || '无'}`,
      }
    }

    case 'add_to_cart': {
      const productId = String(args.product_id || '')
      const quantity = Number(args.quantity) || 1
      const product = context.products.find((p) => p.id === productId)
      if (!product) {
        return { output: `未找到菜品ID: ${productId}，无法加购。` }
      }
      if (context.soldOut.includes(productId)) {
        const alternatives = context.products
          .filter((p) => p.category === product.category && !context.soldOut.includes(p.id))
          .slice(0, 3)
        const altNames = alternatives.map((p) => p.name).join('、')
        return {
          output: `抱歉，${product.name}已售罄。${altNames ? `要不要试试：${altNames}？` : '请选择其他菜品。'}`,
        }
      }
      const portion = String(args.portion || '')
      const flavor = String(args.flavor || '')
      const spicy = String(args.spicy || '')
      const specParts = [portion, flavor, spicy].filter(Boolean)
      const spec = specParts.length ? specParts.join(' · ') : '标准份'
      const portionFactor = portion.includes('半份') || portion.includes('Half') ? 0.58 : 1
      const price = Math.round(product.price * portionFactor)
      const orderedBy = context.diners[0] || '未知'

      return {
        output: `已加入购物车：${product.name} · ${spec}（下单人：${orderedBy}）`,
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
        return {
          output: `未找到购物车项 uid: ${uid}。当前购物车：\n${context.cart.map((c) => `${c.uid}: ${c.name} x${c.quantity}`).join('\n') || '(空)'}`,
        }
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
      const list = context.cart
        .map((c) => `- ${c.uid}: ${c.name} x${c.quantity} ¥${c.price} 规格:${c.spec} 下单人:${c.orderedBy}`)
        .join('\n')
      const total = context.cart.reduce((sum, c) => sum + c.price * c.quantity, 0)
      return { output: `当前购物车：\n${list}\n合计: ¥${total}` }
    }

    default:
      return { output: `未知工具: ${toolName}` }
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
  apiKey: string
  previousResponseId?: string
  context: ProductStateContext
  signal?: AbortSignal
  /** SSE 事件回调，每解析出一个事件调用一次 */
  onEvent: (event: SSEEvent) => void
}

const MAX_TOOL_CALL_ROUNDS = 10

/**
 * 调用 HarnessRouter Cloud API 进行对话。
 * 处理流式响应、tool call 执行和多轮调用。
 */
export async function chatWithHarness(
  opts: ChatOptions
): Promise<{ responseId: string; traceUrl?: string }> {
  const apiKey = opts.apiKey
  if (!apiKey) {
    throw new Error('NO_API_KEY')
  }

  const harnessId = harnessConfig.harness_id
  const instructions = buildSystemInstructions(opts.context)
  const tools = getToolDefinitions()

  let currentResponseId = opts.previousResponseId || ''
  let message: string | Array<Record<string, unknown>> = opts.message
  let traceUrl: string | undefined
  let round = 0

  // 第一轮请求：发送用户消息 + tools
  // 后续轮次：发送 tool call 结果回传

  while (true) {
    round++
    if (round > MAX_TOOL_CALL_ROUNDS + 1) {
      break
    }

    const body: Record<string, unknown> = {
      model: harnessConfig.default_model,
      metadata: { harness_id: harnessId },
      input: message,
      instructions,
      stream: true,
    }

    if (currentResponseId) {
      body.previous_response_id = currentResponseId
    }

    // 第一次请求带 tools，后续 tool 结果回传也带 tools
    body.tools = tools

    const response = await fetch(`${HARNESSROUTER_BASE_URL}/v1/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      const error = new Error(
        `HarnessRouter API error ${response.status}: ${errorText}`
      ) as Error & { status?: number }
      error.status = response.status
      throw error
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

          if (eventType === 'response.output_text.delta') {
            const delta = String(eventData.delta || '')
            fullText += delta
            opts.onEvent({ event: 'text_delta', data: { content: delta } })
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
              const metadata = resp.metadata as Record<string, unknown> | undefined
              if (metadata?.trace_url) {
                traceUrl = String(metadata.trace_url)
              }
              const output = resp.output as Array<Record<string, unknown>> | undefined
              if (output) {
                for (const item of output) {
                  if (
                    item.type === 'function_call' &&
                    !functionCalls.find((fc) => fc.callId === String(item.call_id))
                  ) {
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
      // 执行每个 tool call
      const toolOutputs: Array<{ callId: string; output: string }> = []
      for (const fc of functionCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(fc.arguments || '{}')
        } catch {
          // 参数解析失败用空对象
        }
        const result = executeToolCall(fc.name, args, opts.context)
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

      // 准备下一轮：发送 tool 结果回传
      message = toolOutputs.map((to) => ({
        type: 'function_call_output',
        call_id: to.callId,
        output: to.output,
      }))
      // 继续 while 循环发送 follow-up 请求
    } else {
      // 没有 tool calls，对话完成
      break
    }
  }

  return { responseId: currentResponseId, traceUrl }
}
