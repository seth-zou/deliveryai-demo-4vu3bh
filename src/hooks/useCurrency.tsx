import { useCallback, useEffect, useMemo, useState } from 'react'
import { CURRENCIES, type Currency } from '@/lib/utils'
import { CurrencyContext, STORAGE_KEY } from '@/hooks/currency-context'

function getInitialCurrency(): Currency {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && (CURRENCIES as string[]).includes(stored)) return stored as Currency
  } catch {
    // localStorage 不可用时降级为默认 CNY
  }
  return 'CNY'
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(getInitialCurrency)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, currency)
    } catch {
      // localStorage 不可用时降级为内存态，不报错不阻塞
    }
  }, [currency])

  const setCurrency = useCallback((next: Currency) => {
    setCurrencyState(next)
  }, [])

  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}
