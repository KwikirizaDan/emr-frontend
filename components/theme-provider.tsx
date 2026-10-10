/** Theme provider wrapper that defaults to the operating system colour scheme. */
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/** Applies the class-based theme and follows the OS preference by default. */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
