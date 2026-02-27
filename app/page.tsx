"use client"

import { useState, useEffect } from "react"
import {
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  FileBarChart,
  MapPin,
  Settings,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  X,
  LayoutGrid,
  Menu,
} from "lucide-react"
import { StockOverallView } from "@/components/stock-overall-view"
import { InboundView } from "@/components/inbound-view"
import { OutboundView } from "@/components/outbound-view"
import { StockCheckView } from "@/components/stock-check-view"
import { ReportView } from "@/components/report-view"
import { LocateView } from "@/components/locate-view"
import { SettingsView } from "@/components/settings-view"
import { useDeviceConnection } from "@/lib/device-connection-context"
import { useLocateIntent } from "@/lib/locate-intent-context"

const NAV_ITEMS = [
  { id: "stock-on-hand", label: "Stock Overview", icon: LayoutGrid },
  { id: "inbound", label: "Inbound", icon: ArrowDownToLine },
  { id: "outbound", label: "Outbound", icon: ArrowUpFromLine },
  { id: "stock-check", label: "Stock Check", icon: ClipboardCheck },
  { id: "locate", label: "Locate Item", icon: MapPin },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "settings", label: "Settings", icon: Settings },
]

type OpenTab = {
  id: string
  label: string
  icon: React.ElementType
}

function HomePageContent() {
  const { isConnected } = useDeviceConnection()
  const { intent, clearIntent } = useLocateIntent()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("stock-on-hand")
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    { id: "stock-on-hand", label: "Stock Overview", icon: LayoutGrid },
  ])

  useEffect(() => {
    if (intent) {
      openPage("locate")
    }
  }, [intent])

  function openPage(id: string) {
    const item = NAV_ITEMS.find((n) => n.id === id)
    if (!item) return

    if (!openTabs.find((t) => t.id === id)) {
      setOpenTabs((prev) => [...prev, { id, label: item.label, icon: item.icon }])
    }
    setActiveTab(id)
    setMobileSidebarOpen(false)
  }

  function closeTab(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const remaining = openTabs.filter((t) => t.id !== id)
    setOpenTabs(remaining)
    if (activeTab === id) {
      setActiveTab(remaining[remaining.length - 1]?.id ?? "")
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F0F0F0]">

      {/* ── Mobile overlay ─────────────────────────────── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Left Sidebar ───────────────────────────────── */}
      <aside
        className={`
          flex-shrink-0 flex flex-col bg-[#8B1E24] text-white
          transition-all duration-300 z-50
          fixed inset-y-0 left-0 md:relative md:translate-x-0
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${sidebarCollapsed ? "md:w-[60px]" : "w-[220px]"}
        `}
      >
        {/* Logo */}
        <div
          className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${
            sidebarCollapsed ? "md:justify-center md:px-2" : ""
          }`}
        >
          <span
            className={`font-black text-2xl tracking-tight leading-none select-none ${
              sidebarCollapsed ? "md:hidden" : ""
            }`}
          >
            TUDI
          </span>
          {sidebarCollapsed && (
            <span className="hidden md:block font-black text-xl tracking-tight leading-none select-none">T</span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => openPage(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors
                  ${sidebarCollapsed ? "md:justify-center md:px-2" : ""}
                  ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className={sidebarCollapsed ? "md:hidden" : ""}>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Connection status */}
        <div
          className={`px-4 py-3 border-t border-white/10 flex items-center gap-2 ${
            sidebarCollapsed ? "md:justify-center md:px-2" : ""
          }`}
        >
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-300 flex-shrink-0" />
              <span className={`text-xs text-green-300 ${sidebarCollapsed ? "md:hidden" : ""}`}>
                Connected
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-white/40 flex-shrink-0" />
              <span className={`text-xs text-white/40 ${sidebarCollapsed ? "md:hidden" : ""}`}>
                Disconnected
              </span>
            </>
          )}
        </div>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setSidebarCollapsed((c) => !c)}
          className="hidden md:flex items-center justify-center py-2 border-t border-white/10 hover:bg-white/10 transition-colors"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-white/60" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-white/60" />
          )}
        </button>
      </aside>

      {/* ── Right Panel ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Tab bar ──────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-stretch bg-white border-b border-[#D0D0D0] min-h-[40px]">

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center px-3 border-r border-[#D0D0D0] text-[#555]"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Open page tabs */}
          <div className="flex items-stretch overflow-x-auto flex-1 min-w-0 custom-scrollbar">
            {openTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 border-r border-[#D0D0D0] text-xs font-medium whitespace-nowrap
                    transition-colors flex-shrink-0 group relative
                    ${
                      isActive
                        ? "bg-white text-[#8B1E24] border-b-2 border-b-[#8B1E24]"
                        : "bg-[#EBEBEB] text-[#666] hover:bg-[#F5F5F5] hover:text-[#333]"
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="max-w-[120px] truncate">{tab.label}</span>
                  <span
                    role="button"
                    onClick={(e) => closeTab(tab.id, e)}
                    className={`
                      ml-1 rounded-sm p-0.5 flex-shrink-0 transition-colors
                      ${isActive ? "hover:bg-[#8B1E24]/10 text-[#8B1E24]" : "hover:bg-[#ccc] text-[#999]"}
                    `}
                  >
                    <X className="w-3 h-3" />
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Page content ─────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {openTabs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-[#999] select-none">
              <LayoutGrid className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Select a menu item from the sidebar to get started.</p>
            </div>
          )}
          {activeTab === "stock-on-hand" && <StockOverallView />}
          {activeTab === "inbound" && <InboundView />}
          {activeTab === "outbound" && <OutboundView />}
          {activeTab === "stock-check" && <StockCheckView setActiveTab={openPage} />}
          {activeTab === "locate" && (
            <LocateView
              onNavigateToSettings={() => openPage("settings")}
              clearIntent={clearIntent}
            />
          )}
          {activeTab === "reports" && <ReportView />}
          {activeTab === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  )
}

export default function HomePage() {
  return <HomePageContent />
}
