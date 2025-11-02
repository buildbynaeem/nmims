import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggleButton({
  className,
}: {
  className?: string;
}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Check system preference and localStorage on mount
    const savedTheme = localStorage.getItem("mediguide_theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    const isDarkMode = savedTheme === "dark" || (!savedTheme && systemPrefersDark);
    
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      setDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setDark(false);
    }
  }, []);

  const toggleTheme = () => {
    const newDarkMode = !dark;
    
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("mediguide_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("mediguide_theme", "light");
    }
    
    setDark(newDarkMode);
  };

  return (
    <button
      aria-label="Toggle theme"
      className={`p-2 transition-all duration-200 hover:opacity-70 ${className}`}
      onClick={toggleTheme}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        <Sun className={`absolute h-5 w-5 transition-all duration-300 ${dark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
        <Moon className={`absolute h-5 w-5 transition-all duration-300 ${dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`} />
      </div>
    </button>
  );
}