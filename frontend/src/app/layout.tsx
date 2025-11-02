import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from '@/components/ui/sonner'
import { LanguageProvider } from '@/hooks/useLanguage'
import LanguageToggle from '@/components/LanguageToggle'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgriTech Dashboard - Smart Farming Solutions',
  description: 'AI-powered agricultural dashboard for crop monitoring, disease detection, soil analysis, and weather-based farming recommendations.',
  keywords: ['agriculture', 'farming', 'AI', 'crop monitoring', 'soil analysis', 'weather', 'AgriTech'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <LanguageProvider>
        <html lang="en">
          <body className={inter.className}>
            <LanguageToggle />
            {children}
            <Toaster />
          </body>
        </html>
      </LanguageProvider>
    </ClerkProvider>
  )
}
