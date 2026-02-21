"use client"

import { useState, useMemo } from "react"
import { Filter, Download, FileText, Package, History, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useInventory } from "@/lib/inventory-context"

export function ReportView() {
  const { stockDb } = useInventory()
  const [reportType, setReportType] = useState<"activity" | "stock-check" | "item-history">("activity")

  // Activity filters
  const [operationFilter, setOperationFilter] = useState<string>("ALL")
  const [skuFilter, setSkuFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [descFilter, setDescFilter] = useState("")

  const [historySkuFilter, setHistorySkuFilter] = useState("")
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState("ALL")
  const [historyDescFilter, setHistoryDescFilter] = useState("")
  const [notFoundBeforeDate, setNotFoundBeforeDate] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const categories = ["Apparel", "Footwear", "Accessories", "Home", "Electronics"]

  // Generate activity data from stockDb
  const activityData = useMemo(() => {
    const activities: {
      id: number
      sku: string
      description: string
      category: string
      tid: string
      createdTime: string
      operationType: "INBOUND" | "OUTBOUND" | "STOCK_CHECK"
    }[] = []

    let idCounter = 1

    stockDb.forEach((item) => {
      // Inbound activity
      activities.push({
        id: idCounter++,
        sku: item.sku,
        description: item.description,
        category: item.category,
        tid: item.tid,
        createdTime: item.createdTime,
        operationType: "INBOUND",
      })

      // Stock check activities
      if (item.stockCheckHistory && item.stockCheckHistory.length > 0) {
        item.stockCheckHistory.forEach((checkTime) => {
          activities.push({
            id: idCounter++,
            sku: item.sku,
            description: item.description,
            category: item.category,
            tid: item.tid,
            createdTime: checkTime,
            operationType: "STOCK_CHECK",
          })
        })
      }

      // Outbound activity
      if (item.outboundTime) {
        activities.push({
          id: idCounter++,
          sku: item.sku,
          description: item.description,
          category: item.category,
          tid: item.tid,
          createdTime: item.outboundTime,
          operationType: "OUTBOUND",
        })
      }
    })

    return activities.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
  }, [stockDb])

  // Filtered activity data
  const filteredActivityData = useMemo(() => {
    return activityData.filter((item) => {
      const matchesOperation = operationFilter === "ALL" || item.operationType === operationFilter
      const matchesSku = skuFilter === "" || item.sku.toLowerCase().includes(skuFilter.toLowerCase())
      const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter
      const matchesDesc = descFilter === "" || item.description.toLowerCase().includes(descFilter.toLowerCase())
      return matchesOperation && matchesSku && matchesCategory && matchesDesc
    })
  }, [activityData, operationFilter, skuFilter, categoryFilter, descFilter])

  const stockCheckReport = useMemo(() => {
    // Group active items by SKU
    const activeItems = stockDb.filter((item) => item.status === "Active")
    const grouped = activeItems.reduce(
      (acc, item) => {
        if (!acc[item.sku]) {
          acc[item.sku] = {
            sku: item.sku,
            description: item.description,
            category: item.category,
            expectedQty: 0,
            scannedQty: 0,
          }
        }
        acc[item.sku].expectedQty += 1
        // Count as scanned if has stock check history
        if (item.stockCheckHistory && item.stockCheckHistory.length > 0) {
          acc[item.sku].scannedQty += 1
        }
        return acc
      },
      {} as Record<
        string,
        { sku: string; description: string; category: string; expectedQty: number; scannedQty: number }
      >,
    )

    return Object.values(grouped).map((item) => ({
      ...item,
      missingQty: item.expectedQty - item.scannedQty,
      status: item.expectedQty === item.scannedQty ? "Validated" : "Discrepancy",
    }))
  }, [stockDb])

  const itemHistoryData = useMemo(() => {
    let data = stockDb.map((item) => {
      const lastCheckTime =
        item.stockCheckHistory && item.stockCheckHistory.length > 0
          ? item.stockCheckHistory[item.stockCheckHistory.length - 1]
          : null
      return {
        tid: item.tid,
        sku: item.sku,
        description: item.description,
        category: item.category,
        inboundTime: item.createdTime,
        stockCheckCount: item.stockCheckHistory?.length || 0,
        stockCheckTimes: item.stockCheckHistory || [],
        lastCheckTime,
        outboundTime: item.outboundTime || null,
        status: item.status,
      }
    })

    // Apply filters
    data = data.filter((item) => {
      const matchesSku = historySkuFilter === "" || item.sku.toLowerCase().includes(historySkuFilter.toLowerCase())
      const matchesCategory = historyCategoryFilter === "ALL" || item.category === historyCategoryFilter
      const matchesDesc =
        historyDescFilter === "" || item.description.toLowerCase().includes(historyDescFilter.toLowerCase())

      let matchesNotFound = true
      if (notFoundBeforeDate) {
        const filterDate = new Date(notFoundBeforeDate)
        if (item.lastCheckTime) {
          const lastCheck = new Date(item.lastCheckTime)
          matchesNotFound = lastCheck < filterDate
        } else {
          matchesNotFound = true // Never checked = not found
        }
      }

      return matchesSku && matchesCategory && matchesDesc && matchesNotFound
    })

    // Sort by inbound time
    data.sort((a, b) => {
      const dateA = new Date(a.inboundTime).getTime()
      const dateB = new Date(b.inboundTime).getTime()
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA
    })

    return data
  }, [stockDb, historySkuFilter, historyCategoryFilter, historyDescFilter, notFoundBeforeDate, sortOrder])

  const toggleExpanded = (tid: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(tid)) {
      newExpanded.delete(tid)
    } else {
      newExpanded.add(tid)
    }
    setExpandedItems(newExpanded)
  }

  const getOperationBadge = (type: string) => {
    switch (type) {
      case "INBOUND":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
      case "OUTBOUND":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
      case "STOCK_CHECK":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-foreground">Reports</h2>
        <p className="text-muted-foreground text-xs md:text-sm">Activity logs, stock checking, and item history.</p>
      </div>

      {/* Report Type Selection */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-2 md:p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Report:</span>
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={reportType === "activity" ? "default" : "outline"}
              onClick={() => setReportType("activity")}
              size="sm"
              className="text-xs h-8 px-3"
            >
              <FileText className="w-3.5 h-3.5 mr-1" />
              Activity
            </Button>
            <Button
              variant={reportType === "stock-check" ? "default" : "outline"}
              onClick={() => setReportType("stock-check")}
              size="sm"
              className="text-xs h-8 px-3"
            >
              <Package className="w-3.5 h-3.5 mr-1" />
              Stock Check
            </Button>
            <Button
              variant={reportType === "item-history" ? "default" : "outline"}
              onClick={() => setReportType("item-history")}
              size="sm"
              className="text-xs h-8 px-3"
            >
              <History className="w-3.5 h-3.5 mr-1" />
              Item History
            </Button>
          </div>
        </div>
      </div>

      {/* Activity Reports */}
      {reportType === "activity" && (
        <>
          {/* Filters */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Filters</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>
                <Label className="text-xs">Operation</Label>
                <select
                  value={operationFilter}
                  onChange={(e) => setOperationFilter(e.target.value)}
                  className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background focus:border-primary outline-none"
                >
                  <option value="ALL">All</option>
                  <option value="INBOUND">Inbound</option>
                  <option value="OUTBOUND">Outbound</option>
                  <option value="STOCK_CHECK">Check</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">SKU</Label>
                <Input
                  value={skuFilter}
                  onChange={(e) => setSkuFilter(e.target.value)}
                  placeholder="SKU..."
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background focus:border-primary outline-none"
                >
                  <option value="ALL">All</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input
                  value={descFilter}
                  onChange={(e) => setDescFilter(e.target.value)}
                  placeholder="Desc..."
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button className="w-full h-9 text-sm" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <div className="bg-card border border-border rounded-lg shadow-sm p-2 md:p-4">
              <div className="text-xs text-muted-foreground mb-0.5">Total</div>
              <div className="text-xl md:text-2xl font-bold text-primary">{filteredActivityData.length}</div>
            </div>
            <div className="bg-card border border-border rounded-lg shadow-sm p-2 md:p-4">
              <div className="text-xs text-muted-foreground mb-0.5">Inbound</div>
              <div className="text-xl md:text-2xl font-bold text-green-600">
                {filteredActivityData.filter((item) => item.operationType === "INBOUND").length}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg shadow-sm p-2 md:p-4">
              <div className="text-xs text-muted-foreground mb-0.5">Outbound</div>
              <div className="text-xl md:text-2xl font-bold text-blue-600">
                {filteredActivityData.filter((item) => item.operationType === "OUTBOUND").length}
              </div>
            </div>
          </div>

          {/* Activity Table */}
          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[350px] md:max-h-[400px]">
              <table className="w-full text-left">
                <thead className="bg-primary text-primary-foreground uppercase text-[10px] md:text-xs sticky top-0">
                  <tr>
                    <th className="px-2 md:px-3 py-2 font-semibold">SKU</th>
                    <th className="px-2 md:px-3 py-2 font-semibold hidden sm:table-cell">Description</th>
                    <th className="px-2 md:px-3 py-2 font-semibold hidden md:table-cell">TID</th>
                    <th className="px-2 md:px-3 py-2 font-semibold">Operation</th>
                    <th className="px-2 md:px-3 py-2 font-semibold hidden sm:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredActivityData.length > 0 ? (
                    filteredActivityData.slice(0, 100).map((item) => (
                      <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-2 md:px-3 py-2">
                          <div className="font-bold text-foreground text-xs md:text-sm">{item.sku}</div>
                        </td>
                        <td className="px-2 md:px-3 py-2 text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                          <span className="truncate block max-w-[120px]">{item.description}</span>
                        </td>
                        <td className="px-2 md:px-3 py-2 font-mono text-[10px] md:text-xs text-muted-foreground hidden md:table-cell">
                          {item.tid}
                        </td>
                        <td className="px-2 md:px-3 py-2">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] md:text-xs rounded-full font-medium ${getOperationBadge(item.operationType)}`}
                          >
                            {item.operationType === "STOCK_CHECK" ? "CHECK" : item.operationType}
                          </span>
                        </td>
                        <td className="px-2 md:px-3 py-2 text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                          {new Date(item.createdTime).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        <p className="text-sm">No transactions found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {reportType === "stock-check" && (
        <>
          <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4">
            <h3 className="text-sm md:text-base font-bold text-foreground mb-1">Stock Check Summary</h3>
            <p className="text-xs text-muted-foreground mb-3">Validated items vs database records.</p>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-2 md:p-4">
                <div className="text-xs text-green-700 dark:text-green-300 mb-0.5">Validated</div>
                <div className="text-xl md:text-2xl font-bold text-green-700 dark:text-green-300">
                  {stockCheckReport.filter((item) => item.status === "Validated").length}
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-2 md:p-4">
                <div className="text-xs text-amber-700 dark:text-amber-300 mb-0.5">Discrepancy</div>
                <div className="text-xl md:text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {stockCheckReport.filter((item) => item.status === "Discrepancy").length}
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-2 md:p-4">
                <div className="text-xs text-red-700 dark:text-red-300 mb-0.5">Missing</div>
                <div className="text-xl md:text-2xl font-bold text-red-700 dark:text-red-300">
                  {stockCheckReport.reduce((sum, item) => sum + item.missingQty, 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border flex justify-between items-center">
              <h3 className="text-sm md:text-base font-bold text-foreground">Stock Check Details</h3>
              <Button size="sm" className="h-8 text-xs">
                <Download className="w-3.5 h-3.5 mr-1" />
                Export
              </Button>
            </div>
            <div className="overflow-auto max-h-[350px] md:max-h-[400px]">
              <table className="w-full text-left">
                <thead className="bg-primary text-primary-foreground uppercase text-[10px] md:text-xs sticky top-0">
                  <tr>
                    <th className="px-2 md:px-3 py-2 font-semibold">SKU</th>
                    <th className="px-2 md:px-3 py-2 font-semibold hidden sm:table-cell">Description</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Expected</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Scanned</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Missing</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stockCheckReport.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/50 transition-colors">
                      <td className="px-2 md:px-3 py-2">
                        <div className="font-bold text-foreground text-xs md:text-sm">{item.sku}</div>
                      </td>
                      <td className="px-2 md:px-3 py-2 text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                        <span className="truncate block max-w-[120px]">{item.description}</span>
                      </td>
                      <td className="px-2 md:px-3 py-2 text-center">
                        <span className="text-base md:text-lg font-bold text-foreground">{item.expectedQty}</span>
                      </td>
                      <td className="px-2 md:px-3 py-2 text-center">
                        <span className="text-base md:text-lg font-bold text-green-600">{item.scannedQty}</span>
                      </td>
                      <td className="px-2 md:px-3 py-2 text-center">
                        <span
                          className={`text-base md:text-lg font-bold ${item.missingQty > 0 ? "text-destructive" : "text-green-600"}`}
                        >
                          {item.missingQty}
                        </span>
                      </td>
                      <td className="px-2 md:px-3 py-2 text-center">
                        {item.status === "Validated" ? (
                          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px] md:text-xs rounded-full font-medium">
                            OK
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px] md:text-xs rounded-full font-medium">
                            Gap
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {reportType === "item-history" && (
        <>
          {/* Item History Filters */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Filters</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <div>
                <Label className="text-xs">SKU</Label>
                <Input
                  value={historySkuFilter}
                  onChange={(e) => setHistorySkuFilter(e.target.value)}
                  placeholder="SKU..."
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <select
                  value={historyCategoryFilter}
                  onChange={(e) => setHistoryCategoryFilter(e.target.value)}
                  className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background focus:border-primary outline-none"
                >
                  <option value="ALL">All</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input
                  value={historyDescFilter}
                  onChange={(e) => setHistoryDescFilter(e.target.value)}
                  placeholder="Desc..."
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Not Found Before</Label>
                <Input
                  type="date"
                  value={notFoundBeforeDate}
                  onChange={(e) => setNotFoundBeforeDate(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Sort Order</Label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                  className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background focus:border-primary outline-none"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button className="w-full h-9 text-sm" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </div>

          {/* Item History Table */}
          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border">
              <h3 className="text-sm md:text-base font-bold text-foreground">Item History</h3>
              <p className="text-xs text-muted-foreground">{itemHistoryData.length} items - Click row to expand</p>
            </div>
            <div className="overflow-auto max-h-[400px] md:max-h-[450px]">
              <table className="w-full text-left">
                <thead className="bg-primary text-primary-foreground uppercase text-[10px] md:text-xs sticky top-0">
                  <tr>
                    <th className="px-2 md:px-3 py-2 font-semibold w-8"></th>
                    <th className="px-2 md:px-3 py-2 font-semibold">TID</th>
                    <th className="px-2 md:px-3 py-2 font-semibold hidden sm:table-cell">SKU</th>
                    <th className="px-2 md:px-3 py-2 font-semibold hidden md:table-cell">Inbound</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Checks</th>
                    <th className="px-2 md:px-3 py-2 font-semibold hidden sm:table-cell">Last Check</th>
                    <th className="px-2 md:px-3 py-2 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itemHistoryData.length > 0 ? (
                    itemHistoryData.slice(0, 100).map((item) => {
                      const isExpanded = expandedItems.has(item.tid)
                      return (
                        <>
                          <tr
                            key={item.tid}
                            className="hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => toggleExpanded(item.tid)}
                          >
                            <td className="px-2 md:px-3 py-2">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </td>
                            <td className="px-2 md:px-3 py-2 font-mono text-[10px] md:text-xs">{item.tid}</td>
                            <td className="px-2 md:px-3 py-2 hidden sm:table-cell">
                              <div className="font-bold text-foreground text-xs md:text-sm">{item.sku}</div>
                              <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                {item.description}
                              </div>
                            </td>
                            <td className="px-2 md:px-3 py-2 text-xs md:text-sm text-muted-foreground hidden md:table-cell">
                              {new Date(item.inboundTime).toLocaleDateString()}
                            </td>
                            <td className="px-2 md:px-3 py-2 text-center">
                              <span className="text-base md:text-lg font-bold text-primary">
                                {item.stockCheckCount}
                              </span>
                            </td>
                            <td className="px-2 md:px-3 py-2 text-xs md:text-sm text-muted-foreground hidden sm:table-cell">
                              {item.lastCheckTime ? new Date(item.lastCheckTime).toLocaleDateString() : "Never"}
                            </td>
                            <td className="px-2 md:px-3 py-2 text-center">
                              {item.status === "Active" ? (
                                <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px] md:text-xs rounded-full font-medium">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground text-[10px] md:text-xs rounded-full font-medium">
                                  Out
                                </span>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${item.tid}-expanded`}>
                              <td colSpan={7} className="px-3 md:px-4 py-3 bg-muted/30">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 text-sm">
                                  <div>
                                    <h4 className="font-bold text-xs md:text-sm text-foreground mb-1">Item Details</h4>
                                    <div className="space-y-1 text-xs">
                                      <div>
                                        <span className="text-muted-foreground">SKU:</span> {item.sku}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Description:</span> {item.description}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Category:</span> {item.category}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-xs md:text-sm text-foreground mb-1">Timeline</h4>
                                    <div className="space-y-1 text-xs">
                                      <div>
                                        <span className="text-muted-foreground">Inbound:</span>{" "}
                                        {new Date(item.inboundTime).toLocaleString()}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Last Check:</span>{" "}
                                        {item.lastCheckTime ? new Date(item.lastCheckTime).toLocaleString() : "Never"}
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Outbound:</span>{" "}
                                        {item.outboundTime ? new Date(item.outboundTime).toLocaleString() : "N/A"}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-xs md:text-sm text-foreground mb-1">
                                      Stock Check History ({item.stockCheckCount})
                                    </h4>
                                    {item.stockCheckTimes.length > 0 ? (
                                      <div className="space-y-0.5 text-xs max-h-20 overflow-y-auto">
                                        {item.stockCheckTimes.map((time, idx) => (
                                          <div key={idx} className="text-muted-foreground">
                                            #{idx + 1}: {new Date(time).toLocaleString()}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground italic">No stock checks recorded</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        <p className="text-sm">No items found.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
