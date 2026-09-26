import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Plus, Sparkles, UtensilsCrossed } from 'lucide-react'
import { products } from '@/data/menu'
import type { CartItem, Product } from '@/types'
import { getComboSuggestions, getRecommendations } from '@/lib/recommendation'
import { money } from '@/lib/utils'

interface RecommendationAreaProps {
  cart: CartItem[]
  soldOut: string[]
  diners: string[]
  onProductClick: (product: Product) => void
  onAdd: (item: CartItem) => void
}

/** 为搭配推荐构建默认规格的 CartItem */
function buildDefaultCartItem(product: Product, diner: string, t: (key: string) => string): CartItem {
  const portion = product.options?.portion?.[1] || product.options?.portion?.[0] || ''
  const flavor = product.options?.flavor?.[0] || ''
  const spicy = product.options?.spicy?.[0] || ''
  const portionFactor = portion === 'menu.option.half' ? 0.58 : 1
  const specParts = [portion, flavor, spicy].filter(Boolean).map((key) => t(key))
  const spec = specParts.join(' · ') || t('menu.standard')
  return {
    uid: crypto.randomUUID(),
    productId: product.id,
    name: t(product.name),
    price: Math.round(product.price * portionFactor),
    quantity: 1,
    image: product.image,
    spec,
    orderedBy: diner,
  }
}

export function RecommendationArea({ cart, soldOut, diners, onProductClick, onAdd }: RecommendationAreaProps) {
  const { t } = useTranslation()

  const recommendations = useMemo(
    () => getRecommendations(products, cart, soldOut),
    [cart, soldOut],
  )

  const comboSuggestions = useMemo(
    () => getComboSuggestions(products, cart, soldOut),
    [cart, soldOut],
  )

  const handleAddCombo = (comboItems: Product[]) => {
    for (const product of comboItems) {
      onAdd(buildDefaultCartItem(product, diners[0], t))
    }
  }

  // 无推荐且无搭配时隐藏区域
  if (recommendations.length === 0 && comboSuggestions.length === 0) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-charcoal-900/5 bg-white p-4 text-sm text-charcoal-500 shadow-card dark:border-rice-50/10 dark:bg-charcoal-900 dark:text-rice-200/60 dark:shadow-dark-card">
        <Sparkles size={16} className="shrink-0 text-amber-400" />
        {t('recommend.empty')}
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      {/* 推荐菜品横滑区域 */}
      {recommendations.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <h2 className="text-base font-extrabold text-charcoal-900 dark:text-rice-50">{t('recommend.title')}</h2>
          </div>
          <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
            {recommendations.map(({ product, reasons, inCart }) => {
              const unavailable = soldOut.includes(product.id)
              return (
                <button
                  key={product.id}
                  onClick={() => onProductClick(product)}
                  disabled={unavailable}
                  className="group relative w-40 shrink-0 overflow-hidden rounded-2xl border border-charcoal-900/5 bg-white shadow-card transition hover:-translate-y-1 dark:border-rice-50/10 dark:bg-charcoal-900 dark:shadow-dark-card"
                >
                  <div className="relative h-24 overflow-hidden">
                    <img
                      src={product.image}
                      alt={t(product.name)}
                      className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${unavailable ? 'grayscale' : ''}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    {product.badge && (
                      <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-charcoal-900">
                        {t(product.badge)}
                      </span>
                    )}
                    {inCart && (
                      <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-chili-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                        <Check size={10} />{t('recommend.added')}
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <h3 className="truncate text-sm font-extrabold text-charcoal-900 dark:text-rice-50">{t(product.name)}</h3>
                    <p className="mt-0.5 text-xs font-bold text-chili-500 dark:text-chili-400">{money(product.price)}</p>
                    {reasons.slice(0, 2).map((reason, idx) => (
                      <span
                        key={idx}
                        className="mt-1.5 mr-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-charcoal-700 dark:bg-amber-400/20 dark:text-amber-400"
                      >
                        {t(reason.i18nKey)}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 搭配推荐模块 */}
      {comboSuggestions.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <UtensilsCrossed size={16} className="text-amber-400" />
            <h2 className="text-base font-extrabold text-charcoal-900 dark:text-rice-50">{t('recommend.combo_title')}</h2>
          </div>
          <div className="space-y-2">
            {comboSuggestions.map((combo, comboIdx) => (
              <div
                key={comboIdx}
                className="flex items-center gap-3 rounded-2xl border border-charcoal-900/5 bg-white p-3 shadow-card dark:border-rice-50/10 dark:bg-charcoal-900 dark:shadow-dark-card"
              >
                <div className="flex flex-1 items-center gap-2">
                  {combo.items.map((product, idx) => (
                    <div key={product.id} className="flex items-center gap-2">
                      {idx > 0 && <Plus size={12} className="text-charcoal-500 dark:text-rice-200/40" />}
                      <button
                        onClick={() => onProductClick(product)}
                        className="flex items-center gap-1.5"
                      >
                        <img
                          src={product.image}
                          alt={t(product.name)}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                        <div className="text-left">
                          <p className="text-xs font-bold text-charcoal-900 dark:text-rice-50">{t(product.name)}</p>
                          <p className="text-[10px] font-semibold text-chili-500 dark:text-chili-400">{money(product.price)}</p>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleAddCombo(combo.items)}
                  className="shrink-0 rounded-full bg-chili-500 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:bg-chili-600 dark:bg-chili-400 dark:hover:bg-chili-500"
                >
                  {t('recommend.combo_add')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
