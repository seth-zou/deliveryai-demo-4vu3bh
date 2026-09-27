import express, { type Request, type Response } from 'express'
import { createChatRouter } from './chat-routes.js'

const app = express()
const PORT = Number(process.env.PORT || 3001)

app.use(express.json({ limit: '2mb' }))

app.get('/ping', (_req: Request, res: Response) => {
  res.json({
    message: 'pong',
    timestamp: new Date().toISOString(),
  })
})

// 智能点单助理对话路由
app.use('/api', createChatRouter(express.Router()))

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
