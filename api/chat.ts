/**
 * Vercel Edge Function — HarnessRouter Cloud API 代理
 *
 * 解决浏览器端 CORS 限制：HarnessRouter Cloud API 不支持浏览器端跨域请求，
 * 此 Edge Function 作为同源代理，转发前端请求到 HarnessRouter Cloud API，
 * 并流式回传 SSE 响应。
 *
 * 部署：Vercel 自动识别 /api 目录下的文件为 Serverless/Edge Function
 * 前端调用：fetch('/api/chat', { headers: { 'X-HarnessRouter-API-Key': key } })
 * 代理转发到：https://api.harnessrouter.ai/v1/responses
 */

export const config = { runtime: 'edge' }

const HARNESSROUTER_URL = 'https://api.harnessrouter.ai/v1/responses'

export default async function handler(req: Request): Promise<Response> {
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 从请求头读取前端传入的 API Key
  const apiKey = req.headers.get('X-HarnessRouter-API-Key')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing API key. Please configure HARNESSROUTER_API_KEY.' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // 读取请求体
  const body = await req.text()

  // 转发请求到 HarnessRouter Cloud API
  let upstream: Response
  try {
    upstream = await fetch(HARNESSROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
    })
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to connect to HarnessRouter Cloud API' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // 流式回传响应（SSE 或 JSON 错误）
  const responseHeaders = new Headers()
  const contentType = upstream.headers.get('Content-Type')
  responseHeaders.set('Content-Type', contentType || 'text/event-stream')
  responseHeaders.set('Cache-Control', 'no-cache')
  responseHeaders.set('Connection', 'keep-alive')

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}
