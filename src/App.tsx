import { useEffect, useReducer, useState } from 'react'
import i18next from 'i18next'
import { useTranslation } from 'react-i18next'
import { ClipboardList, ConciergeBell, LayoutDashboard, Menu as MenuIcon, ShoppingBasket } from 'lucide-react'
import { BindTable } from '@/components/BindTable'
import { WelcomeView } from '@/components/WelcomeView'
import { CartPanel } from '@/components/CartPanel'
import { CheckoutView } from '@/components/CheckoutView'
import { DemoConsole } from '@/components/DemoConsole'
import { MenuView } from '@/components/MenuView'
import { OrderView } from '@/components/OrderView'
import { AIAssistant } from '@/components/AIAssistant'
import { ServiceSheet } from '@/components/ServiceSheet'
import { TopBar } from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useElderlyMode } from '@/hooks/useElderlyMode'
import { useCurrency } from '@/hooks/useCurrency'
import { useTheme } from '@/hooks/useTheme'
import { orderReducer, initialState } from '@/state/orderReducer'
import { products } from '@/data/menu'
import { formatMinor, quoteAmounts } from '../shared/currency'
import type { AppState, ViewName } from '@/types'

function createPreviewState(): AppState {
  const preview = new URLSearchParams(window.location.search).get('preview')
  if (preview !== 'menu') return initialState
  const product = products[2]
  const spec = [i18next.t('menu.option.full'), i18next.t('menu.option.original')].join(' · ')
  return {
    ...initialState,
    table: 'A08',
    view: 'menu',
    cart: [{ uid: 'preview-item', productId: product.id, name: i18next.t(product.name), price: product.price, quantity: 1, image: product.image, spec, orderedBy: '姚乾' }],
    lastMessage: initialState.lastMessage,
  }
}

export default function App() {
  const { t, i18n } = useTranslation()
  const [state, dispatch] = useReducer(orderReducer, initialState, createPreviewState)
  const { enabled: elderly, toggle: toggleElderly } = useElderlyMode()
  const { currency, changeCurrency } = useCurrency()
  const { theme, setTheme, isDark } = useTheme()
  const [serviceOpen, setServiceOpen] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const cartQuote = quoteAmounts(state.cart, currency)
  const waitingServices = state.services.filter((service) => service.status === 'waiting').length

  useEffect(() => {
    document.documentElement.lang = i18n.language === 'zh' ? 'zh-CN' : 'en'
    document.title = t('common.title')
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', t('common.meta_desc'))
    // 更新 theme-color meta 标签以适配深色模式
    const themeColor = document.querySelector('meta[name="theme-color"]')
    if (themeColor) themeColor.setAttribute('content', isDark ? '#1a1816' : '#fbf5ea')
    try {
      localStorage.setItem('i18nextLng', i18n.language)
    } catch {
      // localStorage 不可用时降级为内存态，不报错不阻塞
    }
  }, [i18n.language, t, isDark])

  const changeView = (view: ViewName) => dispatch({ type: 'SET_VIEW', view })
  const submitOrder = () => {
    dispatch({ type: 'SUBMIT_ORDER' })
    setCartOpen(false)
  }
  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')
  }
  const handleToggleElderly = () => {
    toggleElderly()
    dispatch({ type: 'SET_MESSAGE', message: elderly ? '已切换为常规模式' : '已切换为老人模式' })
  }

  if (state.view === 'bind' || !state.table) {
    return <BindTable onBind={(table) => dispatch({ type: 'BIND_TABLE', table })} />
  }

  if (state.view === 'welcome') {
    return <WelcomeView table={state.table!} onEnter={() => dispatch({ type: 'SET_VIEW', view: 'menu' })} />
  }

  return (
    <div className="min-h-screen bg-rice-100 paper-noise dark:bg-charcoal-950">
      <TopBar
        currency={currency}
        onCurrency={changeCurrency}
        table={state.table}
        view={state.view}
        serviceCount={waitingServices}
        language={i18n.language}
        elderly={elderly}
        theme={theme}
        isDark={isDark}
        onToggleLanguage={toggleLanguage}
        onToggleElderly={handleToggleElderly}
        onSetTheme={setTheme}
        onView={changeView}
        onService={() => setServiceOpen(true)}
        onConsole={() => setConsoleOpen(true)}
      />

      {state.view === 'menu' && (
        <main className="mx-auto grid max-w-7xl gap-6 px-4 py-5 pb-64 lg:grid-cols-3 lg:px-6 lg:py-7 lg:pb-8">
          <div className="lg:col-span-2">
            <MenuView currency={currency} diners={state.diners} soldOut={state.soldOut} onAdd={(item) => dispatch({ type: 'ADD_CART', item })} />
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-36">
              <CartPanel currency={currency} items={state.cart} onQuantity={(uid, delta) => dispatch({ type: 'CHANGE_QTY', uid, delta })} onSubmit={submitOrder} />
              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-100/70 p-4 text-sm text-charcoal-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-rice-200">
                <p className="font-bold dark:text-amber-400">{t('common.collab_title')}</p>
                <p className="mt-1 leading-6 text-charcoal-500 dark:text-rice-200/60">{t('common.collab_desc')}</p>
              </div>
            </div>
          </aside>
        </main>
      )}

      {state.view === 'order' && (
        <OrderView
          currency={currency}
          items={state.orderItems}
          stage={state.orderStage}
          onAddMore={() => changeView('menu')}
          onCancel={(uid) => dispatch({ type: 'REQUEST_CANCEL', uid })}
          onCheckout={() => changeView('checkout')}
        />
      )}

      {state.view === 'checkout' && (
        <CheckoutView currency={currency} paymentSnapshot={state.paymentSnapshot} items={state.orderItems} paid={state.paid} onPay={() => dispatch({ type: 'PAY' })} onBack={() => changeView('order')} />
      )}

      <ServiceSheet open={serviceOpen} requests={state.services} onOpenChange={setServiceOpen} onCall={(service) => dispatch({ type: 'CALL_SERVICE', service })} />
      <DemoConsole
        open={consoleOpen}
        table={state.table}
        stage={state.orderStage}
        soldOut={state.soldOut}
        services={state.services}
        onOpenChange={setConsoleOpen}
        onStage={(stage) => dispatch({ type: 'SET_STAGE', stage })}
        onSoldOut={(productId) => dispatch({ type: 'TOGGLE_SOLD_OUT', productId })}
        onRespond={() => dispatch({ type: 'RESPOND_SERVICES' })}
        onReset={() => { dispatch({ type: 'RESET' }); setConsoleOpen(false) }}
      />

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent title={t('cart.dialog_title')}>
          <div className="mt-5"><CartPanel currency={currency} compact items={state.cart} onQuantity={(uid, delta) => dispatch({ type: 'CHANGE_QTY', uid, delta })} onSubmit={submitOrder} /></div>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-40 left-4 right-4 z-30 flex justify-center lg:hidden">
        {state.view === 'menu' && state.cart.length > 0 && (
          <Button onClick={() => setCartOpen(true)} className="h-auto min-h-12 max-w-[calc(100vw-2rem)] flex-wrap rounded-full px-4 py-3 shadow-float dark:shadow-dark-float">
            <span className="relative"><ShoppingBasket size={19} /><span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-xs text-charcoal-900">{state.cart.length}</span></span>
            {t('common.view_cart')} · {formatMinor(cartQuote.subtotal, currency)}{currency !== 'CNY' && <span className="text-xs font-normal">{t('currency.reference')}</span>}
          </Button>
        )}
      </div>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-charcoal-900/5 bg-white/95 px-2 pt-2 backdrop-blur dark:border-rice-50/10 dark:bg-charcoal-900/95 lg:hidden">
        <MobileNav active={state.view === 'menu'} icon={MenuIcon} label={t('common.nav_menu')} onClick={() => changeView('menu')} />
        <MobileNav active={state.view === 'order'} icon={ClipboardList} label={t('common.nav_order')} onClick={() => changeView('order')} />
        <MobileNav active={serviceOpen} icon={ConciergeBell} label={t('common.nav_service')} badge={waitingServices} onClick={() => setServiceOpen(true)} />
        <MobileNav active={consoleOpen} icon={LayoutDashboard} label={t('common.nav_demo')} onClick={() => setConsoleOpen(true)} />
      </nav>

      <AIAssistant currency={currency} state={state} dispatch={dispatch} visible={state.view === "menu" || state.view === "order"} />

      <div className="pointer-events-none fixed left-1/2 top-24 z-40 -translate-x-1/2 rounded-full bg-charcoal-900/90 px-4 py-2 text-xs font-semibold text-white shadow-float dark:bg-black/90 dark:shadow-dark-float">
        {state.lastMessage}
      </div>
    </div>
  )
}

function MobileNav({ active, icon: Icon, label, badge, onClick }: { active: boolean; icon: typeof MenuIcon; label: string; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold transition ${active ? 'bg-chili-50 text-chili-500 dark:bg-chili-500/20 dark:text-chili-400' : 'text-charcoal-500 dark:text-rice-200/60'}`}>
      <Icon size={20} />{label}{badge ? <span className="absolute right-4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-chili-500 px-1 text-white dark:bg-chili-400">{badge}</span> : null}
    </button>
  )
}
