import { DEMO_RATES, normalizeCurrency, type CurrencyCode } from '../../shared/currency'
import { useCallback, useRef, useState } from 'react'
import i18next from 'i18next'
import { products } from '@/data/menu'
import type { AppAction, CartItem, AppState } from '@/types'
import { chatWithHarness, type ProductStateContext, type SSEEvent } from '@/lib/harness-adapter'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  currency: CurrencyCode
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

const API_KEY_STORAGE_KEY = 'harnessrouter_api_key'

/** 从 localStorage 读取前端配置的 API Key（演示用途） */
function getStoredApiKey(): string | null {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY)
  } catch {
    return null
  }
}

export { API_KEY_STORAGE_KEY }

/**
 * AI 助理对话状态管理 hook。
 * 前端直连 HarnessRouter Cloud API（https://api.harnessrouter.ai/v1/responses），
 * 解析 SSE 流式响应，执行 tool action，支持多轮 tool call。
 * AI 操作通过 dispatch 转换为 product action，共享同一 orderReducer 状态。
 */
export function useAIAssistant(state: AppState, dispatch: React.Dispatch<AppAction>, currency: CurrencyCode = 'CNY') {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const responseIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const buildContext = useCallback((): ProductStateContext => {
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
      currency: normalizeCurrency(currency),
      pricingCurrency: 'CNY',
      demoRates: DEMO_RATES,
    }
  }, [state.cart, state.soldOut, state.diners, currency])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const context = buildContext()
    const turnCurrency = normalizeCurrency(context.currency)
    setError(null)
    setIsLoading(true)

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      currency: turnCurrency,
    }

    // 添加空的 AI 消息（用于流式填充）
    const aiMsgId = crypto.randomUUID()
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      currency: turnCurrency,
      streaming: true,
    }

    setMessages((prev) => [...prev, userMsg, aiMsg])

    // 创建 AbortController 支持取消
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // 检查 API Key 是否已配置
    const apiKey = getStoredApiKey()
    if (!apiKey) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, streaming: false, content: i18next.t('ai.error_no_key'), error: true }
            : m
        )
      )
      setError(i18next.t('ai.error_no_key'))
      setIsLoading(false)
      abortControllerRef.current = null
      return
    }

    try {
      let accumulatedText = ''

      const result = await chatWithHarness({
        message: text,
        apiKey,
        previousResponseId: responseIdRef.current || undefined,
        context,
        signal: abortController.signal,
        onEvent: (event: SSEEvent) => {
          if (event.event === 'text_delta') {
            const delta = String(event.data.content || '')
            accumulatedText += delta
            setMessages((prev) =>
              prev.map((m) => (m.id === aiMsgId ? { ...m, content: accumulatedText } : m))
            )
          } else if (event.event === 'tool_result') {
            // 执行前端 action（如果有）
            const action = event.data.action as
              | { type: string; payload: Record<string, unknown> }
              | undefined
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
          }
        },
      })

      responseIdRef.current = result.responseId || null

      // 标记 AI 消息为完成
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, streaming: false, traceUrl: result.traceUrl }
            : m
        )
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 用户取消，标记为已停止
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId && m.streaming
              ? {
                  ...m,
                  streaming: false,
                  content:
                    m.content +
                    (m.content ? '\n' : '') +
                    i18next.t('ai.stopped'),
                }
              : m
          )
        )
      } else if (err instanceof Error && err.message === 'NO_API_KEY') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId && m.streaming
              ? { ...m, streaming: false, content: i18next.t('ai.error_no_key'), error: true }
              : m
          )
        )
        setError(i18next.t('ai.error_no_key'))
      } else if (
        err instanceof Error &&
        (err as Error & { status?: number }).status === 401
      ) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId && m.streaming
              ? { ...m, streaming: false, content: i18next.t('ai.error_invalid_key'), error: true }
              : m
          )
        )
        setError(i18next.t('ai.error_invalid_key'))
      } else if (
        err instanceof Error &&
        (err as Error & { status?: number }).status === 403
      ) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId && m.streaming
              ? { ...m, streaming: false, content: i18next.t('ai.error_invalid_key'), error: true }
              : m
          )
        )
        setError(i18next.t('ai.error_invalid_key'))
      } else if (
        err instanceof Error &&
        (err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError') ||
          err.message.includes('network'))
      ) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId && m.streaming
              ? { ...m, streaming: false, content: i18next.t('ai.error_network'), error: true }
              : m
          )
        )
        setError(i18next.t('ai.error_network'))
      } else if (err instanceof Error && (err as Error & { status?: number }).status) {
        // 其他 HTTP 错误（5xx 等）
        const status = (err as Error & { status?: number }).status!
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId && m.streaming
              ? { ...m, streaming: false, content: i18next.t('ai.error'), error: true }
              : m
          )
        )
        setError(`API error ${status}`)
      } else {
        // 通用错误
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId && m.streaming
              ? { ...m, streaming: false, content: i18next.t('ai.error'), error: true }
              : m
          )
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
