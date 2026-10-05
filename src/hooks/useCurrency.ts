import { useCallback, useState } from 'react'
import { normalizeCurrency, type CurrencyCode } from '../../shared/currency'

const STORAGE_KEY = 'display-currency'

/** Display preference stays outside order state so language changes and RESET preserve it. */
export function useCurrency() {
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    try {
      return normalizeCurrency(localStorage.getItem(STORAGE_KEY))
    } catch {
      return 'CNY'
    }
  })
  const changeCurrency = useCallback((next: CurrencyCode) => {
    setCurrency(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Keep this session usable when browser storage is unavailable.
    }
  }, [])
  return { currency, changeCurrency }
}
