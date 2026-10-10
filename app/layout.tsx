import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Merriweather } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const fontHeading = Merriweather({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: {
    default: "Meru EMR",
    template: "%s · Meru EMR",
  },
  description:
    "Clinical workspace for patient registration, encounters, admissions, surgery and follow-up.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("antialiased", fontSans.variable)}>
      <body className={cn("min-h-svh bg-background font-sans", fontMono.variable, fontHeading.variable)}>
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
