import { createContext } from 'react'
import type { Currency } from '@/lib/utils'

export const STORAGE_KEY = 'currency'

export interface CurrencyContextValue {
  currency: Currency
  setCurrency: (currency: Currency) => void
}

export const CurrencyContext = createContext<CurrencyContextValue | null>(null)
