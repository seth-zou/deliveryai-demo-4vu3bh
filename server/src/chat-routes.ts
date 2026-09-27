/**
 * Chat API Routes
 *
 * 提供前端对话接口，代理调用 HarnessRouter Cloud API。
 * 浏览器不直接调用 HarnessRouter API。
 */

import { type Router } from 'express'
import {
  chatWithHarness,
  cancelHarnessResponse,
  executeToolCall,
  getHarnessConfig,
  type ProductStateContext,
  type SSEEvent,
  type FrontendAction,
} from './harness-router.js'

export function createChatRouter(router: Router): Router {

  /**
   * POST /api/chat
   * 接收前端消息 + 产品上下文，调用 HarnessRouter，通过 SSE 流式返回。
   */
  router.post('/chat', async (req, res) => {
    try {
      const { message, feature_key, previous_response_id, context } = req.body as {
        message?: string
        feature_key?: string
        previous_response_id?: string
        context?: ProductStateContext
      }

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required' })
        return
      }

      if (!feature_key || typeof feature_key !== 'string') {
        res.status(400).json({ error: 'feature_key is required' })
        return
      }

      if (!context) {
        res.status(400).json({ error: 'context is required' })
        return
      }

      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')

      // AbortController 支持取消
      const abortController = new AbortController()
      req.on('close', () => abortController.abort())

      const finalResult = await chatWithHarness({
        message,
        featureKey: feature_key,
        previousResponseId: previous_response_id,
        context,
        signal: abortController.signal,
        onEvent: (event: SSEEvent) => {
          res.write(`event: ${event.event}\n`)
          res.write(`data: ${JSON.stringify(event.data)}\n\n`)
        },
      })

      // 发送完成事件
      res.write(`event: done\n`)
      res.write(`data: ${JSON.stringify({ response_id: finalResult.responseId, trace_url: finalResult.traceUrl })}\n\n`)
      res.end()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      // 如果响应头已发送（SSE 模式），通过 SSE 错误事件通知前端
      if (res.headersSent) {
        res.write(`event: error\n`)
        res.write(`data: ${JSON.stringify({ message })}\n\n`)
        res.end()
      } else {
        res.status(500).json({ error: message })
      }
    }
  })

  /**
   * POST /api/chat/cancel
   * 取消正在进行的 HarnessRouter 响应
   */
  router.post('/chat/cancel', async (req, res) => {
    try {
      const { session_id } = req.body as { session_id?: string }

      if (!session_id || typeof session_id !== 'string') {
        res.status(400).json({ error: 'session_id is required' })
        return
      }

      await cancelHarnessResponse(session_id)
      res.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      res.status(500).json({ error: message })
    }
  })

  /**
   * GET /api/chat/config
   * 返回 harness 配置元信息（不含敏感信息）
   */
  router.get('/chat/config', (_req, res) => {
    try {
      const config = getHarnessConfig()
      res.json({
        feature_key: config.feature_key,
        harness_id: config.harness_id,
        workspace_id: config.workspace_id,
        name: config.name,
        model: config.default_model,
        tools: config.tools.map((t) => t.name),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      res.status(500).json({ error: message })
    }
  })

  /**
   * POST /api/chat/tool-test
   * 测试 tool call 执行（开发调试用，不暴露给前端）
   */
  router.post('/chat/tool-test', (req, res) => {
    try {
      const { tool_name, args, context } = req.body as {
        tool_name: string
        args: Record<string, unknown>
        context: ProductStateContext
      }

      if (!tool_name || !context) {
        res.status(400).json({ error: 'tool_name and context are required' })
        return
      }

      const result = executeToolCall(tool_name, args || {}, context)
      res.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      res.status(500).json({ error: message })
    }
  })

  return router
}

export type { FrontendAction, ProductStateContext }
