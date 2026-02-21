"use client"

import { useState, useRef, useMemo, useEffect, useCallback } from "react"
import { CheckCircle2, Filter, Play, Pause, Radio, ChevronDown, ChevronRight, AlertTriangle, Clock, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useInventory } from "@/lib/inventory-context"
import { useDeviceConnection } from "@/lib/device-connection-context"
import { useLocateIntent } from "@/lib/locate-intent-context"
import { LocateDrawer, type CandidateTag } from "@/components/locate-drawer"

type StockCheckItem = {
  sku: string
  description: string
  category: string
  qtyExpected: number
  qtyScanned: number
  scannedItems: { tid: string; description: string; scannedTime: string }[]
  missingItems: { tid: string; description: string; lastSeenTime: string | null }[]
}

interface StockCheckViewProps {
  setActiveTab?: (tab: string) => void
}

export function StockCheckView({ setActiveTab }: StockCheckViewProps = {}) {
  const { stockDb, recordStockCheck } = useInventory()
  const { isConnected } = useDeviceConnection()
  const { setIntent } = useLocateIntent()
  const [stockCheckData, setStockCheckData] = useState<StockCheckItem[]>([])
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [isScanning, setIsScanning] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [skuFilter, setSkuFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [descriptionFilter, setDescriptionFilter] = useState("")
  const [showSkuSuggestions, setShowSkuSuggestions] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedSkuForLocate, setSelectedSkuForLocate] = useState<{ sku: string; description: string; category: string } | null>(null)

  const [checksToRecord, setChecksToRecord] = useState<Array<{ tid: string; timestamp: string }>>([])

  // Handle recording checks in a separate effect to avoid parent state updates during render
  useEffect(() => {
    checksToRecord.forEach(({ tid, timestamp }) => {
      recordStockCheck(tid, timestamp)
    })
    if (checksToRecord.length > 0) {
      setChecksToRecord([])
    }
  }, [checksToRecord, recordStockCheck])

  const categories = ["Apparel", "Footwear", "Accessories", "Home", "Electronics"]

  const allSkuSuggestions = useMemo(() => {
    const skuMap = new Map<string, { sku: string; description: string; qty: number }>()
    stockDb
      .filter((item) => item.status === "Active")
      .forEach((item) => {
        const existing = skuMap.get(item.sku)
        if (existing) {
          existing.qty += 1
        } else {
          skuMap.set(item.sku, { sku: item.sku, description: item.description, qty: 1 })
        }
      })
    return Array.from(skuMap.values())
  }, [stockDb])

  const filteredSkuSuggestions = useMemo(() => {
    if (skuFilter === "") {
      return allSkuSuggestions
    }
    return allSkuSuggestions.filter((item) => item.sku.toLowerCase().includes(skuFilter.toLowerCase()))
  }, [allSkuSuggestions, skuFilter])

  // Initialize stock check from current inventory with filters
  const initializeStockCheck = () => {
    const activeStock = stockDb.filter((item) => {
      if (item.status !== "Active") return false
      const matchesSku = skuFilter === "" || item.sku.toLowerCase().includes(skuFilter.toLowerCase())
      const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter
      const matchesDesc =
        descriptionFilter === "" || item.description.toLowerCase().includes(descriptionFilter.toLowerCase())
      return matchesSku && matchesCategory && matchesDesc
    })

    // Group by SKU
    const grouped = activeStock.reduce(
      (acc, item) => {
        if (!acc[item.sku]) {
          acc[item.sku] = {
            sku: item.sku,
            description: item.description,
            category: item.category,
            qtyExpected: 0,
            qtyScanned: 0,
            scannedItems: [],
            missingItems: [],
          }
        }
        acc[item.sku].qtyExpected += 1
        const lastCheck =
          item.stockCheckHistory && item.stockCheckHistory.length > 0
            ? item.stockCheckHistory[item.stockCheckHistory.length - 1]
            : null
        acc[item.sku].missingItems.push({
          tid: item.tid,
          description: item.description,
          lastSeenTime: lastCheck,
        })
        return acc
      },
      {} as Record<string, StockCheckItem>,
    )

    setStockCheckData(Object.values(grouped))
    setHasStarted(true)
  }

  const toggleRow = (sku: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(sku)) {
      newExpanded.delete(sku)
    } else {
      newExpanded.add(sku)
    }
    setExpandedRows(newExpanded)
  }

  // Start/Stop scanning
  const toggleScanning = () => {
    if (isScanning) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
        scanIntervalRef.current = null
      }
      setIsScanning(false)
    } else {
      setIsScanning(true)
      simulateScan()
    }
  }

  // Simulate RFID scanning
  const simulateScan = () => {
    scanIntervalRef.current = setInterval(() => {
      setStockCheckData((prev) => {
        const updatedData = [...prev]

        // Find items that still need scanning
        const itemsToScan = updatedData.filter((item) => item.qtyScanned < item.qtyExpected)

        if (itemsToScan.length === 0) {
          if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current)
            scanIntervalRef.current = null
          }
          setIsScanning(false)
          return prev
        }

        // Randomly scan an item
        const randomItem = itemsToScan[Math.floor(Math.random() * itemsToScan.length)]
        const itemIndex = updatedData.findIndex((item) => item.sku === randomItem.sku)

        if (itemIndex !== -1) {
          const scannedTids = updatedData[itemIndex].scannedItems.map((s) => s.tid)
          // Find actual item from stockDb that hasn't been scanned yet
          const stockItem = stockDb.find(
            (item) => item.sku === randomItem.sku && item.status === "Active" && !scannedTids.includes(item.tid),
          )

          if (stockItem) {
            const scanTime = new Date().toISOString()
            updatedData[itemIndex].qtyScanned += 1
            updatedData[itemIndex].scannedItems.push({
              tid: stockItem.tid,
              description: stockItem.description,
              scannedTime: scanTime,
            })
            updatedData[itemIndex].missingItems = updatedData[itemIndex].missingItems.filter(
              (m) => m.tid !== stockItem.tid,
            )

            // Queue stock check to be recorded after state update completes
            setChecksToRecord((prev) => [...prev, { tid: stockItem.tid, timestamp: scanTime }])
          }
        }

        return updatedData
      })
    }, 300)
  }

  const totalExpected = stockCheckData.reduce((sum, item) => sum + item.qtyExpected, 0)
  const totalScanned = stockCheckData.reduce((sum, item) => sum + item.qtyScanned, 0)
  const totalMissing = totalExpected - totalScanned

  const allScanned = stockCheckData.every((item) => item.qtyScanned === item.qtyExpected)

  return (
    <div className="space-y-3 md:space-y-4">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-foreground">Stock Check</h2>
        <p className="text-muted-foreground text-xs md:text-sm">
          Compare expected vs scanned quantities and identify missing items.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4">
        <h3 className="text-sm md:text-base font-bold text-foreground mb-2 md:mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filter Items to Check
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <div className="relative">
            <Label htmlFor="sku-filter" className="text-xs">
              SKU
            </Label>
            <Input
              id="sku-filter"
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              onFocus={() => setShowSkuSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSkuSuggestions(false), 200)}
              placeholder="Type or select SKU..."
              className="h-9 text-sm"
              disabled={hasStarted}
            />
            {showSkuSuggestions && !hasStarted && filteredSkuSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredSkuSuggestions.slice(0, 10).map((item, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      setSkuFilter(item.sku)
                      setShowSkuSuggestions(false)
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-xs text-foreground">{item.sku}</div>
                      <span className="text-xs text-primary font-medium">{item.qty}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="category-filter" className="text-xs">
              Category
            </Label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background focus:border-primary outline-none"
              disabled={hasStarted}
            >
              <option value="ALL">All</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="description-filter" className="text-xs">
              Description
            </Label>
            <Input
              id="description-filter"
              value={descriptionFilter}
              onChange={(e) => setDescriptionFilter(e.target.value)}
              placeholder="Description..."
              className="h-9 text-sm"
              disabled={hasStarted}
            />
          </div>
          <div className="flex items-end">
            {!hasStarted ? (
              <Button onClick={initializeStockCheck} className="w-full h-9 text-sm">
                <Play className="w-4 h-4 mr-1" />
                Start
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setHasStarted(false)
                  setStockCheckData([])
                  setSkuFilter("")
                  setCategoryFilter("ALL")
                  setDescriptionFilter("")
                }}
                variant="outline"
                className="w-full h-9 text-sm"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {hasStarted && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <div className="bg-card border border-border rounded-lg shadow-sm p-2 md:p-4">
              <p className="text-xs text-muted-foreground mb-0.5">Expected</p>
              <p className="text-xl md:text-2xl font-bold text-foreground">{totalExpected}</p>
            </div>
            <div className="bg-card border border-border rounded-lg shadow-sm p-2 md:p-4">
              <p className="text-xs text-muted-foreground mb-0.5">Scanned</p>
              <p className="text-xl md:text-2xl font-bold text-green-600">{totalScanned}</p>
            </div>
            <div className="bg-card border border-border rounded-lg shadow-sm p-2 md:p-4">
              <p className="text-xs text-muted-foreground mb-0.5">Missing</p>
              <p
                className={`text-xl md:text-2xl font-bold ${totalMissing > 0 ? "text-destructive" : "text-green-600"}`}
              >
                {totalMissing}
              </p>
            </div>
          </div>

          {/* Scan Control */}
          <div className="flex justify-end">
            <Button
              onClick={toggleScanning}
              variant={isScanning ? "destructive" : "default"}
              disabled={allScanned}
              size="sm"
              className="text-sm h-9"
            >
              {isScanning ? (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4 mr-1" />
                  {allScanned ? "Complete" : "Scan"}
                </>
              )}
            </Button>
          </div>

          {/* Stock Check Table */}
          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border">
              <h3 className="text-sm md:text-base font-bold text-foreground">Stock Check Results</h3>
              <p className="text-xs text-muted-foreground">{stockCheckData.length} SKUs - Click row to expand</p>
            </div>
            <div className="overflow-auto max-h-[350px] md:max-h-[450px]">
              <table className="w-full text-left">
                <thead className="bg-primary text-primary-foreground uppercase text-[10px] md:text-xs sticky top-0">
                  <tr>
                    <th className="px-2 md:px-3 py-2 font-semibold w-8"></th>
                    <th className="px-2 md:px-3 py-2 font-semibold">SKU</th>
                    <th className="px-2 md:px-3 py-2 font-semibold hidden sm:table-cell">Category</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Expected</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Scanned</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Missing</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stockCheckData.map((item) => {
                    const isExpanded = expandedRows.has(item.sku)
                    const missingQty = item.qtyExpected - item.qtyScanned
                    const isMatch = missingQty === 0

                    return (
                      <>
                        <tr
                          key={item.sku}
                          className="hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => toggleRow(item.sku)}
                        >
                          <td className="px-2 md:px-3 py-2">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-2 md:px-3 py-2">
                            <div className="font-bold text-foreground text-xs md:text-sm">{item.sku}</div>
                            <div className="text-[10px] md:text-xs text-muted-foreground truncate max-w-[120px] md:max-w-none">
                              {item.description}
                            </div>
                          </td>
                          <td className="px-2 md:px-3 py-2 hidden sm:table-cell">
                            <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground text-[10px] md:text-xs rounded-full font-medium">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-2 md:px-3 py-2 text-center">
                            <span className="text-base md:text-lg font-bold text-foreground">{item.qtyExpected}</span>
                          </td>
                          <td className="px-2 md:px-3 py-2 text-center">
                            <span className="text-base md:text-lg font-bold text-green-600">{item.qtyScanned}</span>
                          </td>
                          <td className="px-2 md:px-3 py-2 text-center">
                            <span
                              className={`text-base md:text-lg font-bold ${missingQty > 0 ? "text-destructive" : "text-green-600"}`}
                            >
                              {missingQty}
                            </span>
                          </td>
                          <td className="px-2 md:px-3 py-2 text-center">
                            {isMatch ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px] md:text-xs rounded-full font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="hidden md:inline">OK</span>
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const candidateTids = stockDb
                                    .filter((stock) => stock.sku === item.sku && stock.status === "Active")
                                    .map((stock) => ({ tid: stock.tid, epc: stock.epc }))
                                  setIntent({
                                    sku: item.sku,
                                    description: item.description,
                                    category: item.category,
                                    mode: "nearest-sku",
                                    candidateTids,
                                    source: "stock-check",
                                  })
                                  setActiveTab?.("locate")
                                }}
                                className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px] md:text-xs rounded-full font-medium hover:opacity-80 transition-opacity"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <MapPin className="w-2.5 h-2.5" />
                                <span className="hidden md:inline">Locate</span>
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${item.sku}-expanded`}>
                            <td colSpan={7} className="px-2 md:px-4 py-3 bg-muted/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                {/* Found Items */}
                                <div>
                                  <h4 className="font-bold text-xs md:text-sm text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Found Items ({item.scannedItems.length})
                                  </h4>
                                  {item.scannedItems.length > 0 ? (
                                    <div className="bg-green-50 dark:bg-green-950/50 rounded border border-green-200 dark:border-green-800 overflow-hidden">
                                      <table className="w-full text-xs md:text-sm">
                                        <thead className="bg-green-100 dark:bg-green-900/50">
                                          <tr>
                                            <th className="px-2 md:px-3 py-1.5 text-left font-semibold">TID</th>
                                            <th className="px-2 md:px-3 py-1.5 text-left font-semibold hidden sm:table-cell">
                                              Description
                                            </th>
                                            <th className="px-2 md:px-3 py-1.5 text-left font-semibold">Scanned</th>
                                            <th className="px-2 md:px-3 py-1.5 text-center font-semibold w-12">Action</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-green-200 dark:divide-green-800">
                                          {item.scannedItems.map((s, idx) => (
                                            <tr key={idx}>
                                              <td className="px-2 md:px-3 py-1.5 font-mono text-[10px] md:text-xs">
                                                {s.tid}
                                              </td>
                                              <td className="px-2 md:px-3 py-1.5 hidden sm:table-cell text-xs truncate max-w-[120px]">
                                                {s.description}
                                              </td>
                                              <td className="px-2 md:px-3 py-1.5 text-[10px] md:text-xs">
                                                {new Date(s.scannedTime).toLocaleTimeString()}
                                              </td>
                                              <td className="px-2 md:px-3 py-1.5 text-center">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setIntent({
                                                      sku: item.sku,
                                                      description: item.description,
                                                      category: item.category,
                                                      mode: "specific-tid",
                                                      prefillTid: s.tid,
                                                      candidateTids: [{ tid: s.tid, epc: stockDb.find((x) => x.tid === s.tid)?.epc || "" }],
                                                      source: "stock-check",
                                                    })
                                                    setActiveTab?.("locate")
                                                  }}
                                                  className="inline-flex items-center justify-center p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded transition-colors"
                                                  title="Locate this tag"
                                                >
                                                  <MapPin className="w-4 h-4 text-green-700 dark:text-green-300" />
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">No items scanned yet</p>
                                  )}
                                </div>
                                {/* Missing Items */}
                                <div>
                                  <h4 className="font-bold text-xs md:text-sm text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
                                    <AlertTriangle className="w-4 h-4" />
                                    Missing Items ({item.missingItems.length})
                                  </h4>
                                  {item.missingItems.length > 0 ? (
                                    <div className="bg-red-50 dark:bg-red-950/50 rounded border border-red-200 dark:border-red-800 overflow-hidden">
                                      <table className="w-full text-xs md:text-sm">
                                        <thead className="bg-red-100 dark:bg-red-900/50">
                                          <tr>
                                            <th className="px-2 md:px-3 py-1.5 text-left font-semibold">TID</th>
                                            <th className="px-2 md:px-3 py-1.5 text-left font-semibold hidden sm:table-cell">
                                              Description
                                            </th>
                                            <th className="px-2 md:px-3 py-1.5 text-left font-semibold">Last Seen</th>
                                            <th className="px-2 md:px-3 py-1.5 text-center font-semibold w-12">Action</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-red-200 dark:divide-red-800">
                                          {item.missingItems.map((m, idx) => (
                                            <tr key={idx}>
                                              <td className="px-2 md:px-3 py-1.5 font-mono text-[10px] md:text-xs">
                                                {m.tid}
                                              </td>
                                              <td className="px-2 md:px-3 py-1.5 hidden sm:table-cell text-xs truncate max-w-[120px]">
                                                {m.description}
                                              </td>
                                              <td className="px-2 md:px-3 py-1.5 text-[10px] md:text-xs">
                                                {m.lastSeenTime ? (
                                                  <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(m.lastSeenTime).toLocaleDateString()}
                                                  </span>
                                                ) : (
                                                  <span className="text-muted-foreground">Never</span>
                                                )}
                                              </td>
                                              <td className="px-2 md:px-3 py-1.5 text-center">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setIntent({
                                                      sku: item.sku,
                                                      description: item.description,
                                                      category: item.category,
                                                      mode: "specific-tid",
                                                      prefillTid: m.tid,
                                                      candidateTids: [{ tid: m.tid, epc: stockDb.find((x) => x.tid === m.tid)?.epc || "" }],
                                                      source: "stock-check",
                                                    })
                                                    setActiveTab?.("locate")
                                                  }}
                                                  className="inline-flex items-center justify-center p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded transition-colors"
                                                  title="Locate this missing tag"
                                                >
                                                  <MapPin className="w-4 h-4 text-red-700 dark:text-red-300" />
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-green-600 italic">All items found!</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Locate Drawer */}
      {selectedSkuForLocate && (
        <LocateDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          sku={selectedSkuForLocate.sku}
          description={selectedSkuForLocate.description}
          category={selectedSkuForLocate.category}
          candidateTags={
            stockDb
              .filter((item) => item.sku === selectedSkuForLocate.sku && item.status === "Active")
              .map((item) => ({
                epc: item.epc,
                tid: item.tid,
              })) as CandidateTag[]
          }
        />
      )}
    </div>
  )
}
