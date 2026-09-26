import type { CartItem, Product } from '@/types'

/**
 * 推荐菜模块 - 客户端基于规则的推荐算法
 *
 * 支持四个推荐维度：菜品热度排行、时段推荐、口味偏好匹配、搭配推荐
 * 所有计算在前端同步完成，异常时静默降级
 */

/** 推荐理由类型 */
export type ReasonType = 'popularity' | 'timeSlot' | 'tasteMatch' | 'combo'

/** 推荐理由标签 */
export interface RecommendationReason {
  type: ReasonType
  /** i18n key，直接传给 t() 渲染 */
  i18nKey: string
  /** 排序优先级，数字越小优先级越高 */
  priority: number
}

/** 单个推荐菜品结果 */
export interface RecommendationItem {
  product: Product
  score: number
  reasons: RecommendationReason[]
  inCart: boolean
}

/** 搭配推荐组合 */
export interface ComboSuggestion {
  items: Product[]
  /** 搭配的主菜名称（i18n key） */
  mainDishName: string
  reasonI18nKey: string
}

/** 时段类型 */
type TimeSlot = 'lunch' | 'dinner' | 'lateNight' | 'other'

/** 模拟用户口味画像（硬编码，RESET 后恢复） */
export const SIMULATED_PREFERENCES = {
  tags: ['辣', '肉类', '招牌'],
  spicyPreference: 'medium' as const,
}

/** 时段推荐菜品映射 */
const TIME_SLOT_PRODUCTS: Record<TimeSlot, string[]> = {
  lunch: ['p1', 'p3', 'p7'],
  dinner: ['p2', 'p3', 'p5', 'p6'],
  lateNight: ['p9', 'p10', 'p2'],
  other: [],
}

/** 时段到 i18n key 的映射 */
const TIME_SLOT_I18N_KEYS: Record<TimeSlot, string> = {
  lunch: 'recommend.reason.lunch',
  dinner: 'recommend.reason.dinner',
  lateNight: 'recommend.reason.late_night',
  other: '',
}

/** 热度 badge 对应的推荐理由 */
const POPULARITY_BADGES = ['menu.badge.popular', 'menu.badge.signature', 'menu.badge.chef']

/** 主菜品类 */
const MAIN_CATEGORIES = ['menu.cat.broth', 'menu.cat.meat']
/** 配菜品类 */
const COMBO_CATEGORIES = ['menu.cat.veggie', 'menu.cat.staple']

/**
 * 根据当前时间获取时段
 */
export function getTimeSlot(date: Date = new Date()): TimeSlot {
  const hour = date.getHours()
  if (hour >= 10 && hour < 14) return 'lunch'
  if (hour >= 17 && hour < 22) return 'dinner'
  if (hour >= 22 || hour < 2) return 'lateNight'
  return 'other'
}

/**
 * 从购物车中提取会话行为 tags（加购行为动态调整推荐权重）
 */
function getSessionTags(cart: CartItem[], allProducts: Product[]): string[] {
  const tagCounts: Record<string, number> = {}
  for (const item of cart) {
    const product = allProducts.find((p) => p.id === item.productId)
    if (product?.tags) {
      for (const tag of product.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + item.quantity
      }
    }
  }
  return Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([tag]) => tag)
}

/**
 * 从购物车中获取已加购的 productId 集合
 */
function getCartProductIds(cart: CartItem[]): Set<string> {
  return new Set(cart.map((item) => item.productId))
}

/**
 * 检查购物车中是否已有主菜
 */
function hasMainDish(cart: CartItem[], allProducts: Product[]): boolean {
  const cartProductIds = getCartProductIds(cart)
  return allProducts.some(
    (p) => cartProductIds.has(p.id) && MAIN_CATEGORIES.includes(p.category),
  )
}

/**
 * 获取购物车中第一个主菜名称（用于搭配推荐理由）
 */
function getFirstMainDishName(cart: CartItem[], allProducts: Product[]): string {
  const cartProductIds = getCartProductIds(cart)
  const mainDish = allProducts.find(
    (p) => cartProductIds.has(p.id) && MAIN_CATEGORIES.includes(p.category),
  )
  return mainDish?.name || ''
}

/**
 * 计算推荐列表
 *
 * @param allProducts 全部菜品
 * @param cart 当前购物车
 * @param soldOut 售罄菜品 ID 列表
 * @param date 当前时间（用于时段推荐，默认 new Date()）
 * @returns 排序后的推荐列表（最多 6 个）
 */
export function getRecommendations(
  allProducts: Product[],
  cart: CartItem[],
  soldOut: string[],
  date: Date = new Date(),
): RecommendationItem[] {
  try {
    const cartProductIds = getCartProductIds(cart)
    const soldOutSet = new Set(soldOut)
    const timeSlot = getTimeSlot(date)
    const timeSlotProducts = TIME_SLOT_PRODUCTS[timeSlot] || []
    const sessionTags = getSessionTags(cart, allProducts)
    const userTags = SIMULATED_PREFERENCES.tags

    const results: RecommendationItem[] = []

    for (const product of allProducts) {
      // 售罄过滤
      if (soldOutSet.has(product.id)) continue

      const inCart = cartProductIds.has(product.id)
      const reasons: RecommendationReason[] = []
      let score = 0

      // 1. 热度排行
      if (product.orderedCount) {
        score += product.orderedCount * 4
      }
      if (product.badge && POPULARITY_BADGES.includes(product.badge)) {
        score += 5
        reasons.push({
          type: 'popularity',
          i18nKey: 'recommend.reason.popular',
          priority: 1,
        })
      }

      // 2. 时段推荐
      if (timeSlotProducts.includes(product.id)) {
        score += 5
        const timeSlotKey = TIME_SLOT_I18N_KEYS[timeSlot]
        if (timeSlotKey) {
          reasons.push({
            type: 'timeSlot',
            i18nKey: timeSlotKey,
            priority: 2,
          })
        }
      }

      // 3. 口味偏好匹配（模拟画像）
      const productTags = product.tags || []
      const userMatchCount = productTags.filter((tag) => userTags.includes(tag)).length
      if (userMatchCount > 0) {
        score += userMatchCount * 3
        // 辣味标签特殊处理
        if (productTags.includes('辣')) {
          reasons.push({
            type: 'tasteMatch',
            i18nKey: 'recommend.reason.spicy_lover',
            priority: 3,
          })
        } else {
          reasons.push({
            type: 'tasteMatch',
            i18nKey: 'recommend.reason.taste_match',
            priority: 4,
          })
        }
      }

      // 4. 会话行为权重（加购行为动态提升同类 tag 权重）
      if (sessionTags.length > 0) {
        const sessionMatchCount = productTags.filter((tag) =>
          sessionTags.includes(tag),
        ).length
        if (sessionMatchCount > 0) {
          score += sessionMatchCount * 5
        }
      }

      // 5. 已加购降权（不移除，标记"已加购"）
      if (inCart) {
        score -= 50
      }

      // 只有有理由或有一定分数的菜品才纳入推荐
      if (reasons.length > 0 || score > 0) {
        results.push({ product, score, reasons, inCart })
      }
    }

    // 按分数排序，已加购排到最后
    results.sort((a, b) => b.score - a.score)

    // 返回前 6 个
    return results.slice(0, 6)
  } catch {
    // 异常时返回空列表，调用方降级处理
    return []
  }
}

/**
 * 计算搭配推荐
 *
 * 当购物车中已有主菜（broth/meat 类）时，
 * 推荐互补的配菜/饮品组合
 *
 * @param allProducts 全部菜品
 * @param cart 当前购物车
 * @param soldOut 售罄菜品 ID 列表
 * @returns 搭配推荐组合列表（最多 3 个）
 */
export function getComboSuggestions(
  allProducts: Product[],
  cart: CartItem[],
  soldOut: string[],
): ComboSuggestion[] {
  try {
    if (!hasMainDish(cart, allProducts)) return []

    const cartProductIds = getCartProductIds(cart)
    const soldOutSet = new Set(soldOut)
    const mainDishName = getFirstMainDishName(cart, allProducts)

    // 筛选可用的配菜/饮品（未售罄、未加购）
    const availableCombos = allProducts.filter(
      (p) =>
        COMBO_CATEGORIES.includes(p.category) &&
        !soldOutSet.has(p.id) &&
        !cartProductIds.has(p.id),
    )

    if (availableCombos.length < 2) return []

    // 构建搭配组合：每个组合包含一个蔬菜/菌菇 + 一个主食/饮品
    const veggieItems = availableCombos.filter((p) => p.category === 'menu.cat.veggie')
    const stapleItems = availableCombos.filter((p) => p.category === 'menu.cat.staple')

    const combos: ComboSuggestion[] = []

    // 组合 1：蔬菜 + 饮品
    if (veggieItems.length > 0 && stapleItems.length > 0) {
      const veggie = veggieItems[0]
      const staple = stapleItems.find((p) => p.tags?.includes('饮品')) || stapleItems[0]
      combos.push({
        items: [veggie, staple],
        mainDishName,
        reasonI18nKey: 'recommend.reason.pairs',
      })
    }

    // 组合 2：蔬菜 + 主食（如果有不同的蔬菜）
    if (veggieItems.length > 1 && stapleItems.length > 0) {
      const veggie = veggieItems[1]
      const staple = stapleItems.find((p) => p.tags?.includes('粉面')) || stapleItems[0]
      if (staple !== combos[0]?.items[1]) {
        combos.push({
          items: [veggie, staple],
          mainDishName,
          reasonI18nKey: 'recommend.reason.pairs',
        })
      }
    }

    // 组合 3：如果有更多组合
    if (combos.length < 2 && veggieItems.length > 0 && stapleItems.length > 1) {
      const veggie = veggieItems[0]
      const staple = stapleItems[1]
      combos.push({
        items: [veggie, staple],
        mainDishName,
        reasonI18nKey: 'recommend.reason.pairs',
      })
    }

    return combos.slice(0, 3)
  } catch {
    return []
  }
}
