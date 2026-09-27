import { Accessibility, Crown, Languages, LayoutDashboard, MapPin, Monitor, Moon, PhoneCall, ReceiptText, Search, Sun, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { tableAreas } from '@/data/menu'
import type { ThemeMode } from '@/hooks/useTheme'
import { CURRENCIES, currencySymbol, type Currency } from '@/lib/utils'
import type { ViewName } from '@/types'

interface TopBarProps {
  table: string
  view: ViewName
  serviceCount: number
  language: string
  elderly: boolean
  theme: ThemeMode
  isDark: boolean
  currency: Currency
  onToggleLanguage: () => void
  onToggleElderly: () => void
  onSetTheme: (mode: ThemeMode) => void
  onSetCurrency: (currency: Currency) => void
  onView: (view: ViewName) => void
  onService: () => void
  onConsole: () => void
}

export function TopBar({ table, view, serviceCount, language, elderly, theme, isDark, currency, onToggleLanguage, onToggleElderly, onSetTheme, onSetCurrency, onView, onService, onConsole }: TopBarProps) {
  const { t } = useTranslation()
  const areaKey = tableAreas[table]
  const tableLabel = areaKey ? `${table} · ${t(areaKey)}` : table
  const [themePopoverOpen, setThemePopoverOpen] = useState(false)
  const themeBtnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [currencyPopoverOpen, setCurrencyPopoverOpen] = useState(false)
  const currencyBtnRef = useRef<HTMLButtonElement>(null)
  const currencyPopoverRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭主题 popover
  useEffect(() => {
    if (!themePopoverOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        themeBtnRef.current &&
        !themeBtnRef.current.contains(e.target as Node)
      ) {
        setThemePopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [themePopoverOpen])

  // 点击外部关闭币种 popover
  useEffect(() => {
    if (!currencyPopoverOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        currencyPopoverRef.current &&
        !currencyPopoverRef.current.contains(e.target as Node) &&
        currencyBtnRef.current &&
        !currencyBtnRef.current.contains(e.target as Node)
      ) {
        setCurrencyPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [currencyPopoverOpen])

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <>
      <div className="bg-charcoal-900 px-4 py-2 text-center text-xs font-semibold tracking-wide text-rice-100 dark:bg-black dark:text-rice-200">
        {t('common.banner')}
      </div>
      <header className="sticky top-0 z-30 border-b border-charcoal-900/5 bg-rice-50/95 backdrop-blur-xl dark:border-rice-50/10 dark:bg-charcoal-950/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:px-6">
          <button onClick={() => onView('menu')} className="flex items-center gap-2 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chili-500 text-lg font-black text-white shadow-md dark:bg-chili-400">{t('common.brand')}</span>
            <span className="hidden sm:block"><strong className="block leading-4 text-charcoal-900 dark:text-rice-50">{t('common.brand_name')}</strong><small className="text-charcoal-500 dark:text-rice-200/60">{t('common.subtitle')}</small></span>
          </button>
          <span className="ml-1 flex items-center gap-1 rounded-full bg-rice-200 px-3 py-2 text-xs font-bold text-charcoal-700 dark:bg-charcoal-800 dark:text-rice-200"><MapPin size={13} className="text-chili-500 dark:text-chili-400" />{tableLabel}</span>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            <Button variant={view === 'menu' ? 'secondary' : 'ghost'} size="sm" onClick={() => onView('menu')}><Search size={16} />{t('common.nav_menu')}</Button>
            <Button variant={view === 'order' ? 'secondary' : 'ghost'} size="sm" onClick={() => onView('order')}><ReceiptText size={16} />{t('common.nav_order')}</Button>
          </nav>
          <Button variant="outline" size="icon" onClick={onService} className="relative" aria-label={t('common.aria_service')}>
            <PhoneCall size={18} />{serviceCount > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-chili-500 dark:border-charcoal-900" />}
          </Button>
          <Dialog>
            <DialogTrigger asChild><Button variant="outline" size="icon" aria-label={t('common.aria_member')}><UserRound size={18} /></Button></DialogTrigger>
            <DialogContent title={t('common.member_title')}>
              <div className="mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-charcoal-900 to-charcoal-700 p-5 text-white shadow-card dark:from-black dark:to-charcoal-800 dark:shadow-dark-card">
                <div className="flex items-start justify-between"><span className="rounded-xl bg-amber-400 p-2 text-charcoal-900 dark:text-charcoal-900"><Crown /></span><span className="rounded-full bg-white/10 px-3 py-1 text-xs dark:bg-white/5">{t('common.member_badge')}</span></div>
                <p className="mt-6 text-sm text-rice-200 dark:text-rice-200/80">{t('common.member_name')}</p><p className="mt-1 text-2xl font-bold">2,680 <small className="text-sm font-medium text-rice-200 dark:text-rice-200/80">{t('common.growth_value')}</small></p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-charcoal-800 dark:shadow-dark-card"><p className="text-xs text-charcoal-500 dark:text-rice-200/60">{t('common.queue')}</p><p className="mt-2 text-2xl font-extrabold text-charcoal-900 dark:text-rice-50">A018</p><p className="text-xs text-chili-500 dark:text-chili-400">{t('common.queue_ahead')}</p></div>
                <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-charcoal-800 dark:shadow-dark-card"><p className="text-xs text-charcoal-500 dark:text-rice-200/60">{t('common.benefits')}</p><p className="mt-2 text-2xl font-extrabold text-charcoal-900 dark:text-rice-50">4 <small className="text-sm">{t('common.tickets')}</small></p><p className="text-xs text-amber-500">{t('common.coupon')}</p></div>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="icon" onClick={onConsole} aria-label={t('common.aria_console')}><LayoutDashboard size={18} /></Button>

          {/* 主题切换按钮 */}
          <div className="relative">
            <Button
              ref={themeBtnRef}
              variant="outline"
              size="icon"
              onClick={() => setThemePopoverOpen(!themePopoverOpen)}
              aria-label={t('common.aria_theme')}
              aria-pressed={themePopoverOpen}
              className={isDark ? 'text-chili-400' : ''}
            >
              <ThemeIcon size={18} />
            </Button>
            {themePopoverOpen && (
              <div
                ref={popoverRef}
                className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-2xl border border-charcoal-900/10 bg-white p-1.5 shadow-float dark:border-rice-50/10 dark:bg-charcoal-800 dark:shadow-dark-float"
                role="menu"
              >
                <ThemeOption active={theme === 'light'} onClick={() => { onSetTheme('light'); setThemePopoverOpen(false) }} icon={Sun} label={t('common.theme_light')} />
                <ThemeOption active={theme === 'dark'} onClick={() => { onSetTheme('dark'); setThemePopoverOpen(false) }} icon={Moon} label={t('common.theme_dark')} />
                <ThemeOption active={theme === 'auto'} onClick={() => { onSetTheme('auto'); setThemePopoverOpen(false) }} icon={Monitor} label={t('common.theme_auto')} />
              </div>
            )}
          </div>

          {/* 币种切换下拉菜单 */}
          <div className="relative">
            <Button
              ref={currencyBtnRef}
              variant="outline"
              size="sm"
              onClick={() => setCurrencyPopoverOpen(!currencyPopoverOpen)}
              aria-label={t('common.aria_currency')}
              aria-haspopup="menu"
              aria-expanded={currencyPopoverOpen}
            >
              {currencySymbol[currency]}
            </Button>
            {currencyPopoverOpen && (
              <div
                ref={currencyPopoverRef}
                className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-charcoal-900/10 bg-white p-1.5 shadow-float dark:border-rice-50/10 dark:bg-charcoal-800 dark:shadow-dark-float"
                role="menu"
              >
                {CURRENCIES.map((c) => (
                  <CurrencyOption
                    key={c}
                    active={currency === c}
                    onClick={() => { onSetCurrency(c); setCurrencyPopoverOpen(false) }}
                    symbol={currencySymbol[c]}
                    label={t(`common.currency.${c}`)}
                  />
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" size="icon" onClick={onToggleElderly} aria-label={elderly ? '切换至常规模式' : '切换至老人模式'} className={elderly ? 'text-chili-500 dark:text-chili-400' : ''}>
            <Accessibility size={18} />
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleLanguage} aria-label={t('common.aria_lang')}>
            <Languages size={16} />{language === 'zh' ? 'EN' : '中'}
          </Button>
        </div>
      </header>
    </>
  )
}

function ThemeOption({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Sun; label: string }) {
  return (
    <button
      onClick={onClick}
      role="menuitemradio"
      aria-checked={active}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
        active
          ? 'bg-chili-50 text-chili-600 dark:bg-chili-500/20 dark:text-chili-400'
          : 'text-charcoal-700 hover:bg-rice-100 dark:text-rice-200 dark:hover:bg-charcoal-700'
      }`}
    >
      <Icon size={16} />
      {label}
      {active && <span className="ml-auto h-2 w-2 rounded-full bg-chili-500 dark:bg-chili-400" />}
    </button>
  )
}

function CurrencyOption({ active, onClick, symbol, label }: { active: boolean; onClick: () => void; symbol: string; label: string }) {
  return (
    <button
      onClick={onClick}
      role="menuitemradio"
      aria-checked={active}
      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
        active
          ? 'bg-chili-50 text-chili-600 dark:bg-chili-500/20 dark:text-chili-400'
          : 'text-charcoal-700 hover:bg-rice-100 dark:text-rice-200 dark:hover:bg-charcoal-700'
      }`}
    >
      <span className="w-8 shrink-0 tabular-nums">{symbol}</span>
      {label}
      {active && <span className="ml-auto h-2 w-2 rounded-full bg-chili-500 dark:bg-chili-400" />}
    </button>
  )
}
