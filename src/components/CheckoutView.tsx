import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, CreditCard, Gift, MessageCircleQuestion, ReceiptText, ShieldCheck, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { money } from '@/lib/utils'
import type { OrderItem } from '@/types'


// 满减规则常量：满 200 元减 20 元（集中定义，避免魔法数字，参见 NFR-002）
const DISCOUNT_THRESHOLD = 200
const DISCOUNT_AMOUNT = 20

interface CheckoutViewProps { items: OrderItem[]; paid: boolean; onPay: () => void; onBack: () => void }

export function CheckoutView({ items, paid, onPay, onBack }: CheckoutViewProps) {
  const { t } = useTranslation()
  const [method, setMethod] = useState('mobile')
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discount = subtotal >= DISCOUNT_THRESHOLD ? DISCOUNT_AMOUNT : 0
  const payable = subtotal - discount

  if (paid) return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-10"><section className="w-full rounded-3xl bg-white p-7 text-center shadow-float dark:bg-charcoal-900 dark:border dark:border-rice-50/5 dark:shadow-dark-float"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"><Check size={36} /></span><p className="mt-6 text-sm font-bold text-emerald-600 dark:text-emerald-400">{t('checkout.success_badge')}</p><h1 className="mt-2 text-3xl font-extrabold text-charcoal-900 dark:text-rice-50">{t('checkout.success_title')}</h1><p className="mt-3 whitespace-pre-line leading-7 text-charcoal-500 dark:text-rice-200/70">{t('checkout.success_desc')}</p><div className="mt-6 rounded-2xl bg-rice-100 p-4 dark:bg-charcoal-800"><p className="text-sm text-charcoal-500 dark:text-rice-200/60">{t('checkout.paid')}</p><p className="mt-1 text-3xl font-extrabold text-chili-500 dark:text-chili-400">{money(payable)}</p></div><Button onClick={onBack} variant="outline" className="mt-6 w-full">{t('checkout.back')}</Button></section></main>
  )

  const methods = [
    { id: 'mobile', name: t('checkout.method_mobile'), icon: Smartphone, note: t('checkout.method_mobile_note') },
    { id: 'pos', name: t('checkout.method_pos'), icon: CreditCard, note: t('checkout.method_pos_note') },
  ]

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:py-10">
      <button onClick={onBack} className="mb-5 text-sm font-bold text-charcoal-500 hover:text-chili-500 dark:text-rice-200/60 dark:hover:text-chili-400">← {t('checkout.back')}</button>
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="rounded-3xl bg-white p-5 shadow-card dark:bg-charcoal-900 dark:border dark:border-rice-50/5 dark:shadow-dark-card lg:col-span-3">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-chili-50 p-3 text-chili-500 dark:bg-chili-500/20 dark:text-chili-400"><ReceiptText /></span><div><p className="text-xs font-bold text-chili-500 dark:text-chili-400">{t('checkout.badge')}</p><h1 className="text-2xl font-extrabold text-charcoal-900 dark:text-rice-50">{t('checkout.title')}</h1></div></div>
          <div className="mt-6 space-y-3">{items.map((item) => <div key={item.uid} className="flex justify-between text-sm"><span className="text-charcoal-700 dark:text-rice-200">{item.name} <small className="text-charcoal-500 dark:text-rice-200/60">× {item.quantity}</small></span><span className="font-semibold text-charcoal-900 dark:text-rice-100">{money(item.price * item.quantity)}</span></div>)}</div>
          <div className="mt-5 border-t border-dashed border-charcoal-900/10 pt-4 dark:border-rice-50/10"><div className="flex justify-between text-sm text-charcoal-500 dark:text-rice-200/60"><span>{t('checkout.subtotal')}</span><span>{money(subtotal)}</span></div>{discount > 0 && <div className="mt-3 flex justify-between text-sm text-chili-500 dark:text-chili-400"><span className="flex items-center gap-2"><Gift size={15} />{t('checkout.discount')}</span><span>-{money(discount)}</span></div>}<div className="mt-4 flex items-end justify-between text-charcoal-900 dark:text-rice-50"><strong>{t('checkout.payable')}</strong><strong className="text-3xl text-chili-500 dark:text-chili-400">{money(payable)}</strong></div></div>
        </section>
        <section className="rounded-3xl bg-white p-5 shadow-card dark:bg-charcoal-900 dark:border dark:border-rice-50/5 dark:shadow-dark-card lg:col-span-2"><h2 className="font-extrabold text-charcoal-900 dark:text-rice-50">{t('checkout.select_method')}</h2><div className="mt-4 space-y-3">{methods.map(({ id, name, icon: Icon, note }) => <button key={id} onClick={() => setMethod(id)} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${method === id ? 'border-chili-500 bg-chili-50 dark:border-chili-400 dark:bg-chili-500/20' : 'border-charcoal-900/5 bg-rice-50 dark:border-rice-50/10 dark:bg-charcoal-800'}`}><span className="rounded-xl bg-white p-2 text-chili-500 dark:bg-charcoal-700 dark:text-chili-400"><Icon size={20} /></span><span className="flex-1"><strong className="block text-sm text-charcoal-900 dark:text-rice-100">{name}</strong><small className="text-charcoal-500 dark:text-rice-200/60">{note}</small></span>{method === id && <Check size={18} className="text-chili-500 dark:text-chili-400" />}</button>)}</div><Button onClick={onPay} className="mt-5 w-full"><ShieldCheck size={17} />{t('checkout.confirm_pay', { amount: money(payable) })}</Button><button className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-semibold text-charcoal-500 dark:text-rice-200/50"><MessageCircleQuestion size={14} />{t('checkout.question')}</button></section>
      </div>
    </main>
  )
}
