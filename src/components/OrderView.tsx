import { useTranslation } from 'react-i18next'
import { Check, ChefHat, ChevronRight, Clock3, Plus, ReceiptText, RotateCcw, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMinor, quoteAmounts, type CurrencyCode } from '../../shared/currency'
import type { OrderItem, OrderStage } from '@/types'

const stageIcons: Record<OrderStage, typeof Check> = {
  submitted: ReceiptText,
  accepted: Check,
  cooking: ChefHat,
  served: UtensilsCrossed,
}
const stageKeys: OrderStage[] = ['submitted', 'accepted', 'cooking', 'served']
const rank: Record<OrderStage, number> = { submitted: 0, accepted: 1, cooking: 2, served: 3 }

interface OrderViewProps {
  currency?: CurrencyCode
  items: OrderItem[]
  stage: OrderStage
  onAddMore: () => void
  onCancel: (uid: string) => void
  onCheckout: () => void
}

export function OrderView({ currency = 'CNY', items, stage, onAddMore, onCancel, onCheckout }: OrderViewProps) {
  const { t } = useTranslation()
  const quote = quoteAmounts(items.filter((item) => item.cancelState !== 'approved'), currency)
  const lineQuote = quoteAmounts(items, currency)

  if (!items.length) return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center dark:text-rice-50"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-chili-500 shadow-card dark:bg-charcoal-900 dark:text-chili-400 dark:shadow-dark-card"><ReceiptText size={28} /></span><h2 className="mt-5 text-2xl font-extrabold text-charcoal-900 dark:text-rice-50">{t('order.empty_title')}</h2><p className="mt-2 text-charcoal-500 dark:text-rice-200/60">{t('order.empty_desc')}</p><Button onClick={onAddMore} className="mt-6"><Plus size={17} />{t('order.start')}</Button></main>
  )

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 pb-28 lg:px-6 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-chili-500 dark:text-chili-400">{t('order.badge')}</p><h1 className="mt-1 text-3xl font-extrabold text-charcoal-900 dark:text-rice-50">{t('order.title')}</h1></div><Button variant="outline" onClick={onAddMore}><Plus size={17} />{t('order.add_more')}</Button></div>
      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <section className="rounded-3xl bg-charcoal-900 p-5 text-white shadow-card dark:bg-black dark:shadow-dark-card lg:col-span-2">
          <div className="flex items-center justify-between"><h2 className="font-bold">{t('order.progress')}</h2><span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-amber-400 dark:bg-white/5"><Clock3 size={13} />{t('order.realtime')}</span></div>
          <div className="mt-6 space-y-1">
            {stageKeys.map((id, index) => {
              const active = index <= rank[stage]
              const Icon = stageIcons[id]
              return <div key={id} className="relative flex gap-4 pb-7 last:pb-0">{index < stageKeys.length - 1 && <span className={`absolute left-4 top-8 h-full w-px ${active && index < rank[stage] ? 'bg-amber-400' : 'bg-white/15 dark:bg-white/10'}`} />}<span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${active ? 'bg-amber-400 text-charcoal-900' : 'bg-white/10 text-white/40'}`}><Icon size={15} /></span><div><p className={`font-bold ${active ? 'text-white' : 'text-white/40'}`}>{t(`order.stage.${id}.label`)}</p><p className={`mt-1 text-xs ${active ? 'text-rice-200/80' : 'text-white/30'}`}>{active ? t(`order.stage.${id}.note`) : t('order.waiting')}</p></div></div>
            })}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-card dark:bg-charcoal-900 dark:border dark:border-rice-50/5 dark:shadow-dark-card lg:col-span-3">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-charcoal-900 dark:text-rice-50">{t('order.items_title')}</h2><p className="mt-1 text-xs text-charcoal-500 dark:text-rice-200/50">{t('order.order_no')}</p></div><span className="rounded-full bg-chili-50 px-3 py-1 text-xs font-bold text-chili-600 dark:bg-chili-500/20 dark:text-chili-400">{t('order.item_count', { count: items.length })}</span></div>
          {currency !== 'CNY' && <p className="mt-3 text-xs text-charcoal-500 dark:text-rice-200/70">{t('currency.reference')}</p>}
          <div className="mt-5 space-y-4">
            {items.map((item, index) => <div key={item.uid} className="flex gap-3 border-b border-charcoal-900/5 pb-4 last:border-0 dark:border-rice-50/10"><img src={item.image} alt={item.name} className="h-16 w-16 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="truncate font-bold text-charcoal-900 dark:text-rice-50">{item.name} <span className="font-normal text-charcoal-500 dark:text-rice-200/60">× {item.quantity}</span></p><strong className="text-charcoal-900 dark:text-rice-50">{formatMinor(lineQuote.lineAmounts[index], currency)}</strong></div><p className="mt-1 text-xs text-charcoal-500 dark:text-rice-200/50">{item.spec} · {t('order.ordered_by', { name: item.orderedBy })}</p><div className="mt-2 flex items-center justify-between"><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-charcoal-700 dark:bg-amber-400/20 dark:text-amber-400">{t(`order.stage.${item.stage}.label`)}</span>{item.cancelState ? <span className="text-xs font-bold text-amber-500 dark:text-amber-400">{t('order.cancel_pending')}</span> : item.stage !== 'served' && <button onClick={() => onCancel(item.uid)} className="flex items-center gap-1 text-xs font-semibold text-charcoal-500 hover:text-chili-500 dark:text-rice-200/60 dark:hover:text-chili-400"><RotateCcw size={13} />{t('order.cancel')}</button>}</div></div></div>)}
          </div>
          <button className="mt-3 flex w-full items-center justify-between rounded-2xl bg-rice-100 p-4 text-left dark:bg-charcoal-800"><span><small className="block text-charcoal-500 dark:text-rice-200/60">{t('order.total')}</small><strong className="text-xl text-chili-500 dark:text-chili-400">{formatMinor(quote.subtotal, currency)}</strong></span><span className="flex items-center gap-1 text-sm font-bold text-charcoal-900 dark:text-rice-100">{t('order.view_detail')}<ChevronRight size={16} /></span></button>
          <Button onClick={onCheckout} className="mt-4 w-full"><ReceiptText size={17} />{t('order.checkout')}</Button>
        </section>
      </div>
    </main>
  )
}
