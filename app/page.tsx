"use client"

import { useState, useEffect } from "react"
import { Package, ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, FileBarChart, Menu, X, MapPin, Settings, Wifi, WifiOff } from "lucide-react"
import { StockOverallView } from "@/components/stock-overall-view"
import { InboundView } from "@/components/inbound-view"
import { OutboundView } from "@/components/outbound-view"
import { StockCheckView } from "@/components/stock-check-view"
import { ReportView } from "@/components/report-view"
import { LocateView } from "@/components/locate-view"
import { SettingsView } from "@/components/settings-view"
import { useDeviceConnection } from "@/lib/device-connection-context"
import { useLocateIntent } from "@/lib/locate-intent-context"

const tabs = [
  { id: "stock-on-hand", label: "Stock", fullLabel: "Stock Overview", icon: Package },
  { id: "inbound", label: "Inbound", fullLabel: "Inbound", icon: ArrowDownToLine },
  { id: "outbound", label: "Outbound", fullLabel: "Outbound", icon: ArrowUpFromLine },
  { id: "stock-check", label: "Check", fullLabel: "Stock Check", icon: ClipboardCheck },
  { id: "locate", label: "Locate", fullLabel: "Locate Item", icon: MapPin },
  { id: "reports", label: "Reports", fullLabel: "Reports", icon: FileBarChart },
  { id: "settings", label: "Settings", fullLabel: "Settings", icon: Settings },
]

function HomePageContent() {
  const { isConnected } = useDeviceConnection()
  const { intent, clearIntent } = useLocateIntent()
  const [activeTab, setActiveTab] = useState("stock-on-hand")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Auto-switch to locate tab when intent is set
  useEffect(() => {
    if (intent) {
      setActiveTab("locate")
    }
  }, [intent])

  return (
    <div className="min-h-screen bg-background text-foreground pb-6">
      {/* Desktop Top Nav */}
      <header className="hidden md:block border-b border-border px-6 py-3 sticky top-0 bg-background z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground">TUDI RFID</span>
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Device Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">Disconnected</span>
                </>
              )}
            </div>
          </div>
          <nav className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.fullLabel}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden border-b border-border px-4 py-3 sticky top-0 bg-background z-20 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">TUDI RFID</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <nav className="absolute left-0 right-0 top-full bg-background border-b border-border shadow-lg p-2 animate-fade-in">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    setMobileMenuOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.fullLabel}
                </button>
              )
            })}
          </nav>
        )}
      </header>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6 animate-fade-in">
        {activeTab === "stock-on-hand" && <StockOverallView />}
        {activeTab === "inbound" && <InboundView />}
        {activeTab === "outbound" && <OutboundView />}
        {activeTab === "stock-check" && <StockCheckView setActiveTab={setActiveTab} />}
        {activeTab === "locate" && <LocateView onNavigateToSettings={() => setActiveTab("settings")} clearIntent={clearIntent} />}
        {activeTab === "reports" && <ReportView />}
        {activeTab === "settings" && <SettingsView />}
      </main>
    </div>
  )
}

export default function HomePage() {
  return <HomePageContent />
}
