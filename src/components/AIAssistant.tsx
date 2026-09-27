import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Send, Sparkles, Square, Trash2, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAIAssistant, type ChatMessage } from '@/hooks/useAIAssistant'
import type { AppAction, AppState } from '@/types'

interface AIAssistantProps {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  visible: boolean
}

export function AIAssistant({ state, dispatch, visible }: AIAssistantProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    messages,
    isLoading,
    sendMessage,
    stopGeneration,
    clearChat,
    retryLast,
  } = useAIAssistant(state, dispatch)

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // 如果浮窗不可见（如结账页），关闭面板
  useEffect(() => {
    if (!visible) setOpen(false)
  }, [visible])

  if (!visible) return null

  const handleSend = () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    void sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* 悬浮按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t('ai.assistant_title')}
          className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-chili-500 text-white shadow-float transition hover:scale-105 hover:bg-chili-600 active:scale-95 dark:bg-chili-400 dark:shadow-dark-float dark:hover:bg-chili-500 lg:bottom-8 lg:right-8"
        >
          <Bot size={26} />
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-charcoal-900">
            <Sparkles size={12} />
          </span>
        </button>
      )}

      {/* 对话面板 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end lg:items-end lg:right-4 lg:bottom-4 lg:w-96">
          {/* 遮罩层（移动端） */}
          <div
            className="absolute inset-0 bg-charcoal-900/30 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />

          {/* 面板主体 */}
          <div className="relative flex max-h-[75vh] w-full flex-col rounded-t-3xl bg-rice-50 shadow-float dark:bg-charcoal-900 dark:shadow-dark-float lg:max-h-[70vh] lg:rounded-3xl lg:border lg:border-rice-50/10">
            {/* 标题栏 */}
            <div className="flex items-center justify-between border-b border-charcoal-900/5 px-5 py-4 dark:border-rice-50/10">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chili-500 text-white dark:bg-chili-400">
                  <Bot size={18} />
                </span>
                <div>
                  <p className="text-sm font-bold text-charcoal-900 dark:text-rice-50">{t('ai.assistant_title')}</p>
                  <p className="text-xs text-charcoal-500 dark:text-rice-200/60">
                    {isLoading ? t('ai.thinking') : '✨ AI'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    aria-label={t('ai.clear_chat')}
                    className="rounded-full p-2 text-charcoal-500 transition hover:bg-rice-200 hover:text-chili-500 dark:text-rice-200/60 dark:hover:bg-charcoal-800 dark:hover:text-chili-400"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label={t('common.aria_close')}
                  className="rounded-full p-2 text-charcoal-500 transition hover:bg-rice-200 hover:text-chili-500 dark:text-rice-200/60 dark:hover:bg-charcoal-800 dark:hover:text-chili-400"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-none">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-chili-50 text-chili-500 dark:bg-chili-500/20 dark:text-chili-400">
                    <Bot size={28} />
                  </span>
                  <p className="text-sm font-semibold text-charcoal-900 dark:text-rice-50">{t('ai.welcome')}</p>
                  <p className="text-xs text-charcoal-500 dark:text-rice-200/60">{t('ai.quick_hint')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} t={t} onRetry={retryLast} isLoading={isLoading} />
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-1.5 pl-2">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-chili-500 dark:bg-chili-400" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-chili-500 dark:bg-chili-400" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-chili-500 dark:bg-chili-400" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* 底部输入区 */}
            <div className="border-t border-charcoal-900/5 p-3 dark:border-rice-50/10">
              {isLoading ? (
                <Button
                  onClick={stopGeneration}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <Square size={14} />
                  {t('ai.stop')}
                </Button>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('ai.placeholder')}
                    rows={1}
                    className="max-h-24 flex-1 resize-none rounded-2xl border border-charcoal-900/10 bg-white px-4 py-2.5 text-sm text-charcoal-900 outline-none transition placeholder:text-charcoal-500 focus:border-chili-500/30 focus:ring-4 focus:ring-chili-50 dark:border-rice-50/10 dark:bg-charcoal-800 dark:text-rice-50 dark:placeholder:text-rice-200/40 dark:focus:border-chili-400/30 dark:focus:ring-chili-400/10"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-full"
                  >
                    <Send size={16} />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function MessageBubble({ message, t, onRetry, isLoading }: {
  message: ChatMessage
  t: (key: string) => string
  onRetry: () => void
  isLoading: boolean
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-chili-500 px-4 py-2.5 text-sm text-white shadow-sm dark:bg-chili-400">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className={`max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm shadow-sm ${
        message.error
          ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
          : 'bg-white text-charcoal-900 dark:bg-charcoal-800 dark:text-rice-50'
      }`}>
        {message.content || (message.streaming ? '' : '')}
        {message.streaming && message.content && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-chili-500 dark:bg-chili-400" />
        )}
        {message.error && !isLoading && (
          <button
            onClick={onRetry}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-chili-500 hover:underline dark:text-chili-400"
          >
            <RotateCcw size={12} />
            {t('ai.retry')}
          </button>
        )}
      </div>
      {message.traceUrl && (
        <a
          href={message.traceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 text-[10px] text-charcoal-500 hover:text-chili-500 dark:text-rice-200/40 dark:hover:text-chili-400"
        >
          Trace ↗
        </a>
      )}
    </div>
  )
}
