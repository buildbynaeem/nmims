"use client"

import { Button } from "@/components/ui/button"
import { useLanguage, type AppLanguage } from "@/hooks/useLanguage"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const labels: Record<AppLanguage, string> = {
  en: "English",
  hi: "हिंदी",
  mr: "मराठी",
}

export default function LanguageToggle({
  variant = "fixed",
  className,
}: {
  variant?: "fixed" | "inline"
  className?: string
}) {
  const { language, setLanguage } = useLanguage()
  const pathname = usePathname()

  const options: AppLanguage[] = ["en", "hi", "mr"]
  const isHome = pathname === "/"
  const positionClass = "top-4 right-4"

  // Hide global fixed toggle on home page; we'll render inline in header there
  if (variant === "fixed" && isHome) {
    return null
  }

  const containerClasses =
    variant === "fixed"
      ? cn(
          "fixed z-50 bg-white/80 backdrop-blur border rounded-md shadow-sm p-1 flex gap-1",
          positionClass,
          className
        )
      : cn("flex gap-2", className)

  return (
    <div className={containerClasses}>
      {options.map((opt) => (
        <Button
          key={opt}
          variant={language === opt ? "default" : "outline"}
          size="sm"
          onClick={() => setLanguage(opt)}
        >
          {labels[opt]}
        </Button>
      ))}
    </div>
  )
}