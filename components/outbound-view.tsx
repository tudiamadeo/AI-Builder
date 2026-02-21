"use client"

import type React from "react"
import { useState, useRef, useMemo, useEffect, useCallback } from "react"
import { Plus, Radio, CheckCircle2, AlertCircle, Upload, X, Filter, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useInventory } from "@/lib/inventory-context"

type PickingItem = {
  id: string
  sku: string
  description: string
  category: string
  qtyRequired: number
  qtyScanned: number
  qtyAvailable: number
  scannedTids: string[]
  status: "pending" | "scanning" | "completed" | "partial" | "insufficient"
}

export function OutboundView() {
  const { stockDb, removeInventoryByTid } = useInventory()
  const [pickingList, setPickingList] = useState<PickingItem[]>([])
  const [manualSku, setManualSku] = useState("")
  const [manualQty, setManualQty] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [currentScanIndex, setCurrentScanIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [tidsToRemove, setTidsToRemove] = useState<string[]>([])
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [skuFilter, setSkuFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [descFilter, setDescFilter] = useState("")

  const categories = ["Apparel", "Footwear", "Accessories", "Home", "Electronics"]

  const allSkuSuggestions = useMemo(() => {
    const skuQtyMap = new Map<string, { sku: string; description: string; category: string; qty: number }>()
    stockDb
      .filter((item) => item.status === "Active")
      .forEach((item) => {
        const existing = skuQtyMap.get(item.sku)
        if (existing) {
          existing.qty += 1
        } else {
          skuQtyMap.set(item.sku, { sku: item.sku, description: item.description, category: item.category, qty: 1 })
        }
      })
    return Array.from(skuQtyMap.values())
  }, [stockDb])

  const filteredSkuSuggestions = useMemo(() => {
    if (manualSku === "") {
      return allSkuSuggestions
    }
    return allSkuSuggestions.filter((item) => item.sku.toLowerCase().includes(manualSku.toLowerCase()))
  }, [allSkuSuggestions, manualSku])

  const getMaxQtyForSku = (sku: string) => {
    return stockDb.filter((item) => item.sku === sku && item.status === "Active").length
  }

  const selectedSkuMaxQty = manualSku ? getMaxQtyForSku(manualSku) : 0

  const handleSkuChange = (value: string) => {
    setManualSku(value)
    setManualQty("") // Reset qty when SKU changes
  }

  const handleSelectSku = (sku: string) => {
    setManualSku(sku)
    setManualQty("")
    setShowSuggestions(false)
  }

  // Get available stock for a SKU
  const getAvailableStock = (sku: string) => {
    return stockDb.filter((item) => item.sku === sku && item.status === "Active").length
  }

  // Add item to picking list
  const handleAddItem = () => {
    if (!manualSku || !manualQty) return

    const skuData = stockDb.find((item) => item.sku === manualSku)
    if (!skuData) {
      alert("SKU not found in inventory")
      return
    }

    const qtyAvailable = getAvailableStock(manualSku)
    const qtyRequired = Number.parseInt(manualQty)

    if (qtyRequired > qtyAvailable) {
      alert(`Cannot add ${qtyRequired} items. Only ${qtyAvailable} available in stock.`)
      return
    }

    const newItem: PickingItem = {
      id: Date.now().toString(),
      sku: manualSku,
      description: skuData.description,
      category: skuData.category,
      qtyRequired,
      qtyScanned: 0,
      qtyAvailable,
      scannedTids: [],
      status: "pending",
    }

    setPickingList([...pickingList, newItem])
    setManualSku("")
    setManualQty("")
  }

  // Remove item from picking list
  const handleRemoveItem = (id: string) => {
    setPickingList(pickingList.filter((item) => item.id !== id))
  }

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Mock Excel parsing
    const mockItems = [
      { sku: "APP-POLO-BLU-L", qty: 5 },
      { sku: "FTW-RUN-RED-38", qty: 3 },
      { sku: "ACC-WALLET-BLK", qty: 2 },
    ]

    const newItems: PickingItem[] = []
    const errors: string[] = []

    mockItems.forEach((mock) => {
      const skuData = stockDb.find((item) => item.sku === mock.sku)
      if (!skuData) {
        errors.push(`${mock.sku}: SKU not found`)
        return
      }

      const qtyAvailable = getAvailableStock(mock.sku)

      if (mock.qty > qtyAvailable) {
        errors.push(`${mock.sku}: Requested ${mock.qty}, only ${qtyAvailable} available`)
        return
      }

      newItems.push({
        id: Date.now().toString() + "-" + mock.sku,
        sku: mock.sku,
        description: skuData.description,
        category: skuData.category,
        qtyRequired: mock.qty,
        qtyScanned: 0,
        qtyAvailable,
        scannedTids: [],
        status: "pending",
      })
    })

    if (errors.length > 0) {
      alert(`Some items were skipped:\n${errors.join("\n")}`)
    }

    setPickingList([...pickingList, ...newItems])
    e.target.value = ""
  }

  // Start scanning
  const startScanning = () => {
    setIsScanning(true)
    simulateScan()
  }

  // Stop scanning
  const stopScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    setIsScanning(false)
  }

  // Handle TID removals in a separate effect to avoid parent state updates during render
  useEffect(() => {
    tidsToRemove.forEach((tid) => {
      removeInventoryByTid(tid)
    })
    if (tidsToRemove.length > 0) {
      setTidsToRemove([])
    }
  }, [tidsToRemove, removeInventoryByTid])

  const simulateScan = () => {
    scanIntervalRef.current = setInterval(() => {
      setPickingList((prev) => {
        const updatedList = [...prev]
        let currentIdx = currentScanIndex

        // Find next item that needs scanning
        while (currentIdx < updatedList.length) {
          const item = updatedList[currentIdx]
          if (item.status === "completed" || item.status === "partial") {
            currentIdx++
            continue
          }
          break
        }

        if (currentIdx >= updatedList.length) {
          if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current)
            scanIntervalRef.current = null
          }
          setIsScanning(false)
          return prev
        }

        const currentItem = updatedList[currentIdx]
        setCurrentScanIndex(currentIdx)

        // Find available item for this SKU
        const availableItems = stockDb.filter(
          (item) =>
            item.sku === currentItem.sku && item.status === "Active" && !currentItem.scannedTids.includes(item.tid),
        )

        if (availableItems.length > 0 && currentItem.qtyScanned < currentItem.qtyRequired) {
          const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)]
          currentItem.scannedTids.push(randomItem.tid)
          currentItem.qtyScanned += 1
          currentItem.status = "scanning"

          // Queue the TID for removal instead of calling directly
          setTidsToRemove((prev) => [...prev, randomItem.tid])

          if (currentItem.qtyScanned === currentItem.qtyRequired) {
            currentItem.status = "completed"
            setCurrentScanIndex(currentIdx + 1)
          }
        } else if (currentItem.qtyScanned > 0 && currentItem.qtyScanned < currentItem.qtyRequired) {
          // No more stock available, mark as partial
          currentItem.status = "partial"
          setCurrentScanIndex(currentIdx + 1)
        }

        return updatedList
      })
    }, 800)
  }

  const markAsPartial = (id: string) => {
    setPickingList((prev) =>
      prev.map((item) => (item.id === id && item.qtyScanned > 0 ? { ...item, status: "partial" as const } : item)),
    )
  }

  const allItemsComplete = pickingList.every((item) => item.status === "completed" || item.status === "partial")

  const filteredPickingList = pickingList.filter((item) => {
    const matchesSku = skuFilter === "" || item.sku.toLowerCase().includes(skuFilter.toLowerCase())
    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter
    const matchesDesc = descFilter === "" || item.description.toLowerCase().includes(descFilter.toLowerCase())
    return matchesSku && matchesCategory && matchesDesc
  })

  return (
    <div className="space-y-3 md:space-y-4">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-foreground">Outbound - Picking</h2>
        <p className="text-muted-foreground text-xs md:text-sm">Scan items to validate outbound shipments.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 md:gap-4">
        {/* Left Side: Add Item Form + Excel Import */}
        <div className="w-full lg:w-[300px] space-y-3 flex-shrink-0">
          {/* Manual Entry */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4">
            <h3 className="text-sm md:text-base font-bold text-foreground mb-2 md:mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add to Picking List
            </h3>
            <div className="space-y-2 md:space-y-3">
              <div className="relative">
                <Label htmlFor="outbound-sku" className="text-xs">
                  SKU
                </Label>
                <Input
                  id="outbound-sku"
                  value={manualSku}
                  onChange={(e) => handleSkuChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Type or select SKU..."
                  className="h-9 text-sm"
                />
                {showSuggestions && filteredSkuSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredSkuSuggestions.slice(0, 10).map((suggestion, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => handleSelectSku(suggestion.sku)}
                        className="w-full px-3 py-2 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-bold text-xs text-foreground">{suggestion.sku}</div>
                          <span className="text-xs text-primary font-medium">{suggestion.qty} avail</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{suggestion.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="flex justify-between items-center">
                  <Label htmlFor="outbound-qty" className="text-xs">
                    Quantity
                  </Label>
                  {manualSku && <span className="text-xs text-primary font-medium">Max: {selectedSkuMaxQty}</span>}
                </div>
                <Input
                  id="outbound-qty"
                  type="number"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  placeholder="0"
                  className="h-9 text-sm"
                  max={selectedSkuMaxQty}
                />
              </div>
              <Button
                onClick={handleAddItem}
                className="w-full h-9 text-sm"
                disabled={!manualSku || !manualQty || Number(manualQty) > selectedSkuMaxQty}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4">
            <h3 className="text-sm md:text-base font-bold text-foreground mb-2 md:mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Excel Import
            </h3>
            <div className="space-y-2">
              <Label htmlFor="outbound-excel-upload" className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 px-3 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors border-2 border-dashed border-border">
                  <Upload className="w-4 h-4" />
                  Choose File
                </div>
              </Label>
              <Input
                id="outbound-excel-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelImport}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground text-center">SKU, Quantity columns</p>
            </div>
          </div>
        </div>

        {/* Right Side: Picking List */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-sm md:text-base font-bold text-foreground">Picking List</h3>
                <p className="text-xs text-muted-foreground">{pickingList.length} items</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                {isScanning ? (
                  <Button
                    onClick={stopScanning}
                    variant="destructive"
                    size="sm"
                    className="flex-1 sm:flex-initial text-sm h-9"
                  >
                    <Radio className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    onClick={startScanning}
                    disabled={pickingList.length === 0 || allItemsComplete}
                    size="sm"
                    className="flex-1 sm:flex-initial text-sm h-9"
                  >
                    <Radio className="w-4 h-4 mr-1" />
                    Scan
                  </Button>
                )}
              </div>
            </div>

            <div className="px-3 md:px-4 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-1.5 mb-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Filters</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="SKU..."
                  value={skuFilter}
                  onChange={(e) => setSkuFilter(e.target.value)}
                  className="h-8 text-xs"
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-8 border border-input rounded-md px-2 text-xs bg-background focus:border-primary outline-none"
                >
                  <option value="ALL">All</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Desc..."
                  value={descFilter}
                  onChange={(e) => setDescFilter(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="overflow-auto flex-1 max-h-[300px] md:max-h-[400px]">
              <table className="w-full text-left">
                <thead className="bg-primary text-primary-foreground uppercase text-[10px] md:text-xs sticky top-0">
                  <tr>
                    <th className="px-2 md:px-3 py-2 font-semibold">SKU</th>
                    <th className="px-2 md:px-3 py-2 font-semibold hidden sm:table-cell">Description</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Req</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Scanned</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Status</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPickingList.length > 0 ? (
                    filteredPickingList.map((item, index) => (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          index === currentScanIndex && isScanning ? "bg-blue-50 dark:bg-blue-950" : "hover:bg-muted/50"
                        }`}
                      >
                        <td className="px-2 md:px-3 py-2">
                          <div className="font-bold text-foreground text-xs md:text-sm">{item.sku}</div>
                          <div className="text-[10px] text-muted-foreground sm:hidden truncate max-w-[100px]">
                            {item.description}
                          </div>
                        </td>
                        <td className="px-2 md:px-3 py-2 text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                          <span className="truncate block max-w-[150px]">{item.description}</span>
                        </td>
                        <td className="px-2 md:px-3 py-2 text-center">
                          <span className="text-base md:text-lg font-bold text-foreground">{item.qtyRequired}</span>
                        </td>
                        <td className="px-2 md:px-3 py-2 text-center">
                          <span className="text-base md:text-lg font-bold text-primary">{item.qtyScanned}</span>
                        </td>
                        <td className="px-2 md:px-3 py-2 text-center">
                          {item.status === "completed" ? (
                            <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px] md:text-xs rounded-full font-medium">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" />
                              <span className="hidden md:inline">Done</span>
                            </span>
                          ) : item.status === "partial" ? (
                            <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px] md:text-xs rounded-full font-medium">
                              <AlertTriangle className="w-3 h-3 mr-0.5" />
                              <span className="hidden md:inline">Partial</span>
                            </span>
                          ) : item.status === "scanning" ? (
                            <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] md:text-xs rounded-full font-medium">
                              <Radio className="w-3 h-3 mr-0.5" />
                              <span className="hidden md:inline">Scan</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 bg-muted text-muted-foreground text-[10px] md:text-xs rounded-full font-medium">
                              <AlertCircle className="w-3 h-3 mr-0.5" />
                              <span className="hidden md:inline">Pending</span>
                            </span>
                          )}
                        </td>
                        <td className="px-2 md:px-3 py-2 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        <p className="text-sm">No items in picking list.</p>
                        <p className="text-xs">Add items manually or import from Excel.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
