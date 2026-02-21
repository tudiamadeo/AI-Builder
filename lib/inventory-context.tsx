"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

type InventoryItem = {
  id: string
  sku: string
  description: string
  category: string
  epc: string
  tid: string
  createdTime: string
  status: "Active" | "Removed"
  outboundTime?: string
  stockCheckHistory?: string[]
}

type InventoryContextType = {
  stockDb: InventoryItem[]
  addInventoryItems: (items: InventoryItem[]) => void
  removeInventoryByTid: (tid: string) => void
  recordStockCheck: (tid: string, timestamp: string) => void
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined)

const INITIAL_STOCK: InventoryItem[] = [
  // Apparel - Polo Shirts
  ...Array.from({ length: 15 }).map((_, i) => ({
    id: `POLO-BLU-${i}`,
    sku: "APP-POLO-BLU-L",
    description: "Mens Cotton Polo Shirt - Blue Size L",
    category: "Apparel",
    epc: `EPC-POLO-BLU-${i + 1000}`,
    tid: `TID-POLO-BLU-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-01 09:00:00",
    status: "Active" as const,
    stockCheckHistory: ["2025-12-10 14:00:00"],
  })),
  ...Array.from({ length: 10 }).map((_, i) => ({
    id: `POLO-RED-${i}`,
    sku: "APP-POLO-RED-M",
    description: "Mens Cotton Polo Shirt - Red Size M",
    category: "Apparel",
    epc: `EPC-POLO-RED-${i + 1100}`,
    tid: `TID-POLO-RED-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-02 10:30:00",
    status: "Active" as const,
    stockCheckHistory: [],
  })),
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `TSHIRT-WHT-${i}`,
    sku: "APP-TSHIRT-WHT-XL",
    description: "Premium Cotton T-Shirt - White Size XL",
    category: "Apparel",
    epc: `EPC-TSHIRT-WHT-${i + 1200}`,
    tid: `TID-TSHIRT-WHT-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-03 11:15:00",
    status: "Active" as const,
    stockCheckHistory: ["2025-12-08 09:00:00", "2025-12-12 15:00:00"],
  })),
  // Footwear
  ...Array.from({ length: 12 }).map((_, i) => ({
    id: `SHOE-RUN-RED-${i}`,
    sku: "FTW-RUN-RED-38",
    description: "Womens Running Shoes - Red Size 38",
    category: "Footwear",
    epc: `EPC-RUN-RED-${i + 2000}`,
    tid: `TID-RUN-RED-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-05 14:20:00",
    status: "Active" as const,
    stockCheckHistory: ["2025-12-10 14:30:00"],
  })),
  ...Array.from({ length: 6 }).map((_, i) => ({
    id: `SHOE-SNEAK-BLK-${i}`,
    sku: "FTW-SNEAK-BLK-42",
    description: "Mens Sneakers - Black Size 42",
    category: "Footwear",
    epc: `EPC-SNEAK-BLK-${i + 2100}`,
    tid: `TID-SNEAK-BLK-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-06 08:45:00",
    status: "Active" as const,
    stockCheckHistory: [],
  })),
  ...Array.from({ length: 4 }).map((_, i) => ({
    id: `SHOE-LOAF-BRN-${i}`,
    sku: "FTW-LOAF-BRN-40",
    description: "Leather Loafers - Brown Size 40",
    category: "Footwear",
    epc: `EPC-LOAF-BRN-${i + 2200}`,
    tid: `TID-LOAF-BRN-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-07 16:00:00",
    status: "Active" as const,
    stockCheckHistory: ["2025-12-12 10:00:00"],
  })),
  // Accessories
  ...Array.from({ length: 8 }).map((_, i) => ({
    id: `WALLET-BLK-${i}`,
    sku: "ACC-WALLET-BLK",
    description: "Leather Wallet - Black",
    category: "Accessories",
    epc: `EPC-WALLET-BLK-${i + 3000}`,
    tid: `TID-WALLET-BLK-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-08 11:15:00",
    status: "Active" as const,
    stockCheckHistory: ["2025-12-09 10:00:00", "2025-12-11 14:00:00"],
  })),
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: `BELT-BRN-${i}`,
    sku: "ACC-BELT-BRN-M",
    description: "Leather Belt - Brown Size M",
    category: "Accessories",
    epc: `EPC-BELT-BRN-${i + 3100}`,
    tid: `TID-BELT-BRN-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-09 09:30:00",
    status: "Active" as const,
    stockCheckHistory: [],
  })),
  ...Array.from({ length: 10 }).map((_, i) => ({
    id: `WATCH-SLV-${i}`,
    sku: "ACC-WATCH-SLV",
    description: "Classic Watch - Silver",
    category: "Accessories",
    epc: `EPC-WATCH-SLV-${i + 3200}`,
    tid: `TID-WATCH-SLV-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-10 13:00:00",
    status: "Active" as const,
    stockCheckHistory: ["2025-12-12 11:00:00"],
  })),
  // Home
  ...Array.from({ length: 20 }).map((_, i) => ({
    id: `MUG-WHT-${i}`,
    sku: "HOM-MUG-WHT",
    description: "Ceramic Mug - White",
    category: "Home",
    epc: `EPC-MUG-WHT-${i + 4000}`,
    tid: `TID-MUG-WHT-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-11 10:00:00",
    status: "Active" as const,
    stockCheckHistory: [],
  })),
  ...Array.from({ length: 7 }).map((_, i) => ({
    id: `VASE-BLU-${i}`,
    sku: "HOM-VASE-BLU",
    description: "Decorative Vase - Blue",
    category: "Home",
    epc: `EPC-VASE-BLU-${i + 4100}`,
    tid: `TID-VASE-BLU-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-12 14:30:00",
    status: "Active" as const,
    stockCheckHistory: [],
  })),
  // Electronics
  ...Array.from({ length: 3 }).map((_, i) => ({
    id: `EARBUDS-BLK-${i}`,
    sku: "ELC-EARBUDS-BLK",
    description: "Wireless Earbuds - Black",
    category: "Electronics",
    epc: `EPC-EARBUDS-BLK-${i + 5000}`,
    tid: `TID-EARBUDS-BLK-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-13 09:00:00",
    status: "Active" as const,
    stockCheckHistory: [],
  })),
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: `CHARGER-USB-${i}`,
    sku: "ELC-CHARGER-USB",
    description: "USB-C Fast Charger",
    category: "Electronics",
    epc: `EPC-CHARGER-USB-${i + 5100}`,
    tid: `TID-CHARGER-USB-${String(i).padStart(4, "0")}`,
    createdTime: "2025-12-14 11:30:00",
    status: "Active" as const,
    stockCheckHistory: [],
  })),
]

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [stockDb, setStockDb] = useState<InventoryItem[]>(INITIAL_STOCK)

  const addInventoryItems = (items: InventoryItem[]) => {
    setStockDb((prev) => [...prev, ...items])
  }

  const removeInventoryByTid = (tid: string) => {
    setStockDb((prev) =>
      prev.map((item) =>
        item.tid === tid ? { ...item, status: "Removed" as const, outboundTime: new Date().toISOString() } : item,
      ),
    )
  }

  const recordStockCheck = (tid: string, timestamp: string) => {
    setStockDb((prev) =>
      prev.map((item) =>
        item.tid === tid ? { ...item, stockCheckHistory: [...(item.stockCheckHistory || []), timestamp] } : item,
      ),
    )
  }

  return (
    <InventoryContext.Provider value={{ stockDb, addInventoryItems, removeInventoryByTid, recordStockCheck }}>
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const context = useContext(InventoryContext)
  if (!context) {
    throw new Error("useInventory must be used within InventoryProvider")
  }
  return context
}
