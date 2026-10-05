import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, CreditCard, Gift, MessageCircleQuestion, ReceiptText, ShieldCheck, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMoney, formatMinor, quoteAmounts, type CurrencyCode } from '../../shared/currency'
import type { OrderItem, PaymentSnapshot } from '@/types'

interface CheckoutViewProps {
  items: OrderItem[]
  paid: boolean
  currency?: CurrencyCode
  paymentSnapshot?: PaymentSnapshot | null
  onPay: () => void
  onBack: () => void
}

export function CheckoutView({ items, paid, currency = 'CNY', paymentSnapshot, onPay, onBack }: CheckoutViewProps) {
  const { t } = useTranslation()
  const [method, setMethod] = useState('mobile')
  const billedItems = (paid && paymentSnapshot ? paymentSnapshot.items : items).filter((item) => item.cancelState !== 'approved')
  const quote = quoteAmounts(billedItems, currency, true)
  const foreign = currency !== 'CNY'
  const actualPaid = paymentSnapshot ? formatMoney(paymentSnapshot.paidCny) : formatMinor(quote.cny.payable)

  if (paid) return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-10 pb-28 lg:pb-10">
      <section className="w-full rounded-3xl bg-white p-7 text-center shadow-float dark:bg-charcoal-900 dark:border dark:border-rice-50/5 dark:shadow-dark-float">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"><Check size={36} /></span>
        <p className="mt-6 text-sm font-bold text-emerald-600 dark:text-emerald-400">{t('checkout.success_badge')}</p>
        <h1 className="mt-2 text-3xl font-extrabold text-charcoal-900 dark:text-rice-50">{t('checkout.success_title')}</h1>
        <p className="mt-3 whitespace-pre-line leading-7 text-charcoal-500 dark:text-rice-200/70">{t('checkout.success_desc')}</p>
        <div className="mt-6 rounded-2xl bg-rice-100 p-4 dark:bg-charcoal-800">
          <p className="text-sm text-charcoal-500 dark:text-rice-200/60">{t('currency.actual_paid')}</p>
          <p className="mt-1 text-3xl font-extrabold text-chili-500 dark:text-chili-400">{actualPaid}</p>
        </div>
        {foreign && <div className="mt-4 text-sm text-charcoal-700 dark:text-rice-200"><span>{t('currency.reference_paid')}</span><strong className="ml-2">{formatMinor(quote.payable, currency)}</strong><p className="mt-1 text-xs text-charcoal-500 dark:text-rice-200/70">{t('currency.reference')}</p></div>}
        <Button onClick={onBack} variant="outline" className="mt-6 w-full">{t('checkout.back')}</Button>
      </section>
    </main>
  )

  const methods = [
    { id: 'mobile', name: t('checkout.method_mobile'), icon: Smartphone, note: t('checkout.method_mobile_note') },
    { id: 'pos', name: t('checkout.method_pos'), icon: CreditCard, note: t('checkout.method_pos_note') },
  ]

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 pb-28 lg:py-10">
      <button onClick={onBack} className="mb-5 text-sm font-bold text-charcoal-500 hover:text-chili-500 dark:text-rice-200/60">← {t('checkout.back')}</button>
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="rounded-3xl bg-white p-5 shadow-card dark:bg-charcoal-900 dark:border dark:border-rice-50/5 dark:shadow-dark-card lg:col-span-3">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-chili-50 p-3 text-chili-500 dark:bg-chili-500/20 dark:text-chili-400"><ReceiptText /></span><div><p className="text-xs font-bold text-chili-500 dark:text-chili-400">{t('checkout.badge')}</p><h1 className="text-2xl font-extrabold text-charcoal-900 dark:text-rice-50">{t('checkout.title')}</h1></div></div>
          {foreign && <p className="mt-4 text-xs text-charcoal-500 dark:text-rice-200/70">{t('currency.reference')}</p>}
          <div className="mt-6 space-y-3">{billedItems.map((item, index) => <div key={item.uid} className="flex justify-between gap-3 text-sm"><span className="text-charcoal-700 dark:text-rice-200">{item.name} <small className="text-charcoal-500 dark:text-rice-200/60">× {item.quantity}</small></span><span className="shrink-0 font-semibold text-charcoal-900 dark:text-rice-100">{formatMinor(quote.lineAmounts[index], currency)}</span></div>)}</div>
          <div className="mt-5 border-t border-dashed border-charcoal-900/10 pt-4 dark:border-rice-50/10">
            <div className="flex justify-between text-sm text-charcoal-500 dark:text-rice-200/60"><span>{t(foreign ? 'currency.reference_subtotal' : 'checkout.subtotal')}</span><span>{formatMinor(quote.subtotal, currency)}</span></div>
            {quote.discount > 0 && <>
              <div className="mt-3 flex justify-between text-sm text-chili-500 dark:text-chili-400"><span className="flex items-center gap-2"><Gift size={15} />{t(foreign ? 'currency.reference_discount' : 'checkout.discount')}</span><span>-{formatMinor(quote.discount, currency)}</span></div>
              {foreign && <p className="mt-2 text-xs leading-5 text-charcoal-500 dark:text-rice-200/70">{t('checkout.discount')} · {t('currency.discount_rule', { threshold: formatMoney(200, currency), amount: formatMoney(20, currency) })}</p>}
            </>}
            {foreign && <div className="mt-4 flex justify-between text-sm text-charcoal-700 dark:text-rice-200"><span>{t('currency.reference_payable')}</span><strong>{formatMinor(quote.payable, currency)}</strong></div>}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-2 text-charcoal-900 dark:text-rice-50"><strong>{t(foreign ? 'currency.actual_payable' : 'checkout.payable')}</strong><strong className="text-3xl text-chili-500 dark:text-chili-400">{formatMinor(quote.cny.payable)}</strong></div>
          </div>
        </section>
        <section className="rounded-3xl bg-white p-5 shadow-card dark:bg-charcoal-900 dark:border dark:border-rice-50/5 dark:shadow-dark-card lg:col-span-2">
          <h2 className="font-extrabold text-charcoal-900 dark:text-rice-50">{t('checkout.select_method')}</h2>
          <div className="mt-4 space-y-3">{methods.map(({ id, name, icon: Icon, note }) => <button key={id} onClick={() => setMethod(id)} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${method === id ? 'border-chili-500 bg-chili-50 dark:border-chili-400 dark:bg-chili-500/20' : 'border-charcoal-900/5 bg-rice-50 dark:border-rice-50/10 dark:bg-charcoal-800'}`}><span className="rounded-xl bg-white p-2 text-chili-500 dark:bg-charcoal-700 dark:text-chili-400"><Icon size={20} /></span><span className="flex-1"><strong className="block text-sm text-charcoal-900 dark:text-rice-100">{name}</strong><small className="text-charcoal-500 dark:text-rice-200/60">{note}</small></span>{method === id && <Check size={18} className="text-chili-500 dark:text-chili-400" />}</button>)}</div>
          {foreign && <p className="mt-4 text-center text-xs text-charcoal-500 dark:text-rice-200/70">{t('currency.settlement')}</p>}
          <Button onClick={onPay} className="mt-5 w-full"><ShieldCheck size={17} />{t('checkout.confirm_pay', { amount: formatMinor(quote.cny.payable) })}</Button>
          <button className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-semibold text-charcoal-500 dark:text-rice-200/50"><MessageCircleQuestion size={14} />{t('checkout.question')}</button>
        </section>
      </div>
    </main>
  )
}
