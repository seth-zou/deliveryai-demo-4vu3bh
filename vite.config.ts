import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite dev middleware: /api/chat 代理
 *
 * 开发环境下拦截 /api/chat 请求，转发到 HarnessRouter Cloud API，
 * 模拟 Vercel Edge Function 的同源代理行为，避免 CORS 问题。
 * 生产环境由 Vercel Edge Function (api/chat.ts) 处理。
 */
function harnessProxyPlugin(): PluginOption {
  return {
    name: 'harness-router-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        // 收集请求体
        const chunks: Buffer[] = []
        for await (const chunk of req) {
          chunks.push(chunk as Buffer)
        }
        const body = Buffer.concat(chunks).toString('utf-8')

        // 从请求头读取 API Key
        const apiKey = req.headers['x-harnessrouter-api-key'] as string | undefined
        if (!apiKey) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing API key' }))
          return
        }

        // 转发到 HarnessRouter Cloud API
        try {
          const upstream = await fetch('https://api.harnessrouter.ai/v1/responses', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body,
          })

          // 流式回传响应
          res.statusCode = upstream.status
          const contentType = upstream.headers.get('Content-Type') || 'text/event-stream'
          res.setHeader('Content-Type', contentType)
          res.setHeader('Cache-Control', 'no-cache')
          res.setHeader('Connection', 'keep-alive')

          if (upstream.body) {
            const reader = upstream.body.getReader()
            const decoder = new TextDecoder()
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              res.write(decoder.decode(value, { stream: true }))
            }
          }
          res.end()
        } catch {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Failed to connect to HarnessRouter Cloud API' }))
        }
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), harnessProxyPlugin()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
})
