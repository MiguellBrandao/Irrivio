import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Geist, Geist_Mono, Inter } from "next/font/google"

import { Providers } from "@/app/providers"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  ACTIVE_COMPANY_NAME_COOKIE_NAME,
  ACTIVE_COMPANY_FAVICON_COOKIE_NAME,
  APPLICATION_NAME,
  buildApplicationTitle,
  normalizeCompanyAssetPath,
} from "@/lib/auth/company-assets"
import { cn } from "@/lib/utils"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const activeCompanyName = cookieStore.get(ACTIVE_COMPANY_NAME_COOKIE_NAME)?.value
  const faviconPath = normalizeCompanyAssetPath(
    cookieStore.get(ACTIVE_COMPANY_FAVICON_COOKIE_NAME)?.value
  )

  return {
    title: buildApplicationTitle(activeCompanyName),
    description: `Login e area interna do ${APPLICATION_NAME}`,
    icons: {
      icon: faviconPath,
      shortcut: faviconPath,
    },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-PT" className={cn("font-sans", inter.variable)}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider>
          <Providers>
            {children}
            <Toaster richColors position="top-right" />
          </Providers>
        </TooltipProvider>
      </body>
    </html>
  )
}
