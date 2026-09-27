import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type Currency = 'CNY' | 'USD' | 'EUR' | 'JPY' | 'HKD' | 'TWD'

/** 全部受支持货币，供状态校验与切换 UI 遍历使用 */
export const CURRENCIES: Currency[] = ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'TWD']

/**
 * 以 CNY 为基准的固定汇率：1 CNY = rates[currency] 单位目标货币。
 * 演示用途，取经验近似固定值，不接入实时汇率。
 */
const rates: Record<Currency, number> = {
  CNY: 1,
  USD: 0.14,
  EUR: 0.13,
  JPY: 21,
  HKD: 1.09,
  TWD: 4.5,
}

/** 各币种展示符号 */
export const currencySymbol: Record<Currency, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  HKD: 'HK$',
  TWD: 'NT$',
}

const currencyFormatter: Record<Currency, Intl.NumberFormat> = {
  CNY: new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  USD: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  EUR: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  JPY: new Intl.NumberFormat('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  HKD: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  TWD: new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
}

/**
 * 格式化金额展示（先换算，再按币种精度取整）。
 * - 传入的 value 始终为 CNY 底价，函数内部按固定汇率换算到目标货币。
 * - CNY：不换算，¥1,234.56
 * - USD/EUR/HKD：两位小数，$1,234.56 / €1,234.56 / HK$1,234.56
 * - JPY/TWD：整数，¥1,234 / NT$1,234
 * 向后兼容：不传 currency 参数时默认 CNY。
 */
export const money = (value: number, currency: Currency = 'CNY') => {
  const converted = value * rates[currency]
  return `${currencySymbol[currency]}${currencyFormatter[currency].format(converted)}`
}
