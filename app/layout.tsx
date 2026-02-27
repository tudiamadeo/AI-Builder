import type React from "react"
import type { Metadata } from "next"

import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { InventoryProvider } from "@/lib/inventory-context"
import { DeviceConnectionProvider } from "@/lib/device-connection-context"
import { LocateIntentProvider } from "@/lib/locate-intent-context"
import { Geist_Mono, Montserrat as V0_Font_Montserrat, Geist_Mono as V0_Font_Geist_Mono } from 'next/font/google'

// Initialize fonts
const _montserrat = V0_Font_Montserrat({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })
const _geistMono = V0_Font_Geist_Mono({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })

export const metadata: Metadata = {
  title: "TUDI RFID",
  description: "RFID inventory management system",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <DeviceConnectionProvider>
          <LocateIntentProvider>
            <InventoryProvider>{children}</InventoryProvider>
          </LocateIntentProvider>
        </DeviceConnectionProvider>
        <Analytics />
      </body>
    </html>
  )
}
