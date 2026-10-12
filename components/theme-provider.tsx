/** Theme provider wrapper. The EMR ships as a light-only workspace. */
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Applies the class-based theme. The app is light-only: `forcedTheme` pins the
 * theme to light and ignores the OS/user preference, so the `.dark` tokens and
 * `dark:` utilities are never activated. The provider is kept (rather than
 * removed) because `sonner` reads the active theme from `useTheme()`.
 */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
