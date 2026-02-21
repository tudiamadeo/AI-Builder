'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type LocateMode = 'nearest-sku' | 'specific-tid'

export interface LocateIntent {
  sku: string
  description: string
  category: string
  mode: LocateMode
  prefillTid?: string // For manual TID fallback
  candidateTids: Array<{ tid: string; epc: string }>
}

interface LocateIntentContextType {
  intent: LocateIntent | null
  setIntent: (intent: LocateIntent | null) => void
  clearIntent: () => void
}

const LocateIntentContext = createContext<LocateIntentContextType | undefined>(undefined)

export function LocateIntentProvider({ children }: { children: ReactNode }) {
  const [intent, setIntent] = useState<LocateIntent | null>(null)

  const clearIntent = useCallback(() => {
    setIntent(null)
  }, [])

  return (
    <LocateIntentContext.Provider value={{ intent, setIntent, clearIntent }}>
      {children}
    </LocateIntentContext.Provider>
  )
}

export function useLocateIntent() {
  const context = useContext(LocateIntentContext)
  if (!context) {
    throw new Error('useLocateIntent must be used within LocateIntentProvider')
  }
  return context
}
