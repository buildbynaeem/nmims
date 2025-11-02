"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type AppLanguage = 'en' | 'hi' | 'mr'

type LanguageContextValue = {
  language: AppLanguage
  setLanguage: (lang: AppLanguage) => void
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>('en')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('agritech.lang') as AppLanguage | null
      if (stored === 'en' || stored === 'hi' || stored === 'mr') {
        setLanguage(stored)
      }
    } catch {}
  }, [])

  const value = useMemo(() => ({
    language,
    setLanguage: (lang: AppLanguage) => {
      setLanguage(lang)
      try {
        localStorage.setItem('agritech.lang', lang)
      } catch {}
    }
  }), [language])

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}