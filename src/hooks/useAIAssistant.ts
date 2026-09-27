import { useCallback, useRef, useState } from 'react'
import i18next from 'i18next'
import { products } from '@/data/menu'
import type { AppAction, CartItem, AppState } from '@/types'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  streaming?: boolean
  error?: boolean
  traceUrl?: string
}

export interface AIAssistantState {
  messages: ChatMessage[]
  isLoading: boolean
  responseId: string | null
  error: string | null
}

const SERVER_URL = import.meta.env.VITE_AI_SERVER_URL || 'http://localhost:3001'

/**
 * AI 助理对话状态管理 hook。
 * 负责与产品服务端通信（SSE 流式），接收 AI 响应和 tool action。
 * AI 操作通过 dispatch 转换为 product action，共享同一 orderReducer 状态。
 */
export function useAIAssistant(state: AppState, dispatch: React.Dispatch<AppAction>) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const responseIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const buildContext = useCallback(() => {
    return {
      products: products.map((p) => ({
        id: p.id,
        name: i18next.t(p.name),
        description: i18next.t(p.description),
        category: p.category,
        price: p.price,
        options: p.options,
      })),
      cart: state.cart.map((c) => ({
        uid: c.uid,
        productId: c.productId,
        name: c.name,
        price: c.price,
        quantity: c.quantity,
        spec: c.spec,
        orderedBy: c.orderedBy,
      })),
      soldOut: state.soldOut,
      diners: state.diners,
      language: i18next.language,
    }
  }, [state.cart, state.soldOut, state.diners])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    setError(null)
    setIsLoading(true)

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }

    // 添加空的 AI 消息（用于流式填充）
    const aiMsgId = crypto.randomUUID()
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      streaming: true,
    }

    setMessages((prev) => [...prev, userMsg, aiMsg])

    // 创建 AbortController 支持取消
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const response = await fetch(`${SERVER_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          feature_key: 'smart_order_assistant',
          previous_response_id: responseIdRef.current || undefined,
          context: buildContext(),
          session_id: responseIdRef.current || undefined,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // 解析 SSE 流
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE 事件以双换行分隔
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const eventBlock of events) {
          const lines = eventBlock.split('\n')
          let eventType = 'message'
          let eventData = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7)
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6)
            }
          }

          if (!eventData) continue

          let parsed: Record<string, unknown>
          try {
            parsed = JSON.parse(eventData)
          } catch {
            continue
          }

          if (eventType === 'text_delta') {
            const delta = String(parsed.content || '')
            accumulatedText += delta
            setMessages((prev) =>
              prev.map((m) => m.id === aiMsgId ? { ...m, content: accumulatedText } : m)
            )
          } else if (eventType === 'tool_result') {
            // 执行前端 action（如果有）
            const action = parsed.action as { type: string; payload: Record<string, unknown> } | undefined
            if (action) {
              if (action.type === 'ADD_CART') {
                const item = action.payload as unknown as CartItem
                dispatch({ type: 'ADD_CART', item })
              } else if (action.type === 'CHANGE_QTY') {
                const uid = String(action.payload.uid)
                const delta = Number(action.payload.delta)
                dispatch({ type: 'CHANGE_QTY', uid, delta })
              }
            }
          } else if (eventType === 'done') {
            responseIdRef.current = String(parsed.response_id || '')
            const traceUrl = parsed.trace_url as string | undefined
            setMessages((prev) =>
              prev.map((m) => m.id === aiMsgId ? { ...m, streaming: false, traceUrl } : m)
            )
          } else if (eventType === 'error') {
            const errorMsg = String(parsed.message || 'Assistant error')
            setMessages((prev) =>
              prev.map((m) => m.id === aiMsgId ? { ...m, streaming: false, content: accumulatedText || errorMsg, error: true } : m)
            )
            setError(errorMsg)
          }
        }
      }

      // 如果流结束时 AI 消息仍为 streaming，标记为完成
      setMessages((prev) =>
        prev.map((m) => m.id === aiMsgId && m.streaming ? { ...m, streaming: false } : m)
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 用户取消，标记为已停止
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsgId && m.streaming ? { ...m, streaming: false, content: m.content + (m.content ? '\n' : '') + i18next.t('ai.stopped') } : m)
        )
      } else {
        const errorMsg = err instanceof Error ? err.message : 'Network error'
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsgId && m.streaming ? { ...m, streaming: false, content: i18next.t('ai.error'), error: true } : m)
        )
        setError(errorMsg)
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [isLoading, buildContext, dispatch])

  const stopGeneration = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    // 也通知服务端取消
    if (responseIdRef.current) {
      try {
        await fetch(`${SERVER_URL}/api/chat/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: responseIdRef.current }),
        })
      } catch {
        // 取消请求失败不阻塞用户
      }
    }
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
    responseIdRef.current = null
  }, [])

  const retryLast = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUserMsg) {
      // 移除最后一条 AI 消息（可能是错误消息）
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant' && (last.error || last.content === '')) {
          return prev.slice(0, -1)
        }
        return prev
      })
      void sendMessage(lastUserMsg.content)
    }
  }, [messages, sendMessage])

  return {
    messages,
    isLoading,
    error,
    responseId: responseIdRef.current,
    sendMessage,
    stopGeneration,
    clearChat,
    retryLast,
  }
}
