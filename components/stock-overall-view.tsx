"use client"

import { useState, useMemo } from "react"
import { Search, LayoutList, Tag, Download, PackageX, Filter } from "lucide-react"
import { useInventory } from "@/lib/inventory-context"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ViewMode = "summary" | "detail"

export function StockOverallView() {
  const { stockDb } = useInventory()
  const [viewMode, setViewMode] = useState<ViewMode>("summary")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [skuFilter, setSkuFilter] = useState("")
  const [descFilter, setDescFilter] = useState("")
  const [showSkuSuggestions, setShowSkuSuggestions] = useState(false)

  const categories = ["Apparel", "Footwear", "Accessories", "Home", "Electronics"]

  // Summary data - group by SKU
  const summaryData = useMemo(() => {
    const grouped = stockDb.reduce(
      (acc, item) => {
        if (item.status !== "Active") return acc

        if (!acc[item.sku]) {
          acc[item.sku] = {
            sku: item.sku,
            description: item.description,
            category: item.category,
            totalQty: 0,
          }
        }
        acc[item.sku].totalQty += 1
        return acc
      },
      {} as Record<string, { sku: string; description: string; category: string; totalQty: number }>,
    )

    return Object.values(grouped)
  }, [stockDb])

  const allSkus = useMemo(() => {
    return summaryData.map((item) => ({
      sku: item.sku,
      description: item.description,
      qty: item.totalQty,
    }))
  }, [summaryData])

  const filteredSkuSuggestions = useMemo(() => {
    if (skuFilter === "") {
      return allSkus
    }
    return allSkus.filter((item) => item.sku.toLowerCase().includes(skuFilter.toLowerCase()))
  }, [allSkus, skuFilter])

  // Filter logic
  const filteredSummary = useMemo(() => {
    return summaryData.filter((item) => {
      const matchesSearch =
        searchQuery === "" ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesSku = skuFilter === "" || item.sku.toLowerCase().includes(skuFilter.toLowerCase())
      const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter
      const matchesDesc = descFilter === "" || item.description.toLowerCase().includes(descFilter.toLowerCase())
      return matchesSearch && matchesSku && matchesCategory && matchesDesc
    })
  }, [summaryData, searchQuery, skuFilter, categoryFilter, descFilter])

  const filteredDetail = useMemo(() => {
    return stockDb.filter((item) => {
      if (item.status !== "Active") return false
      const matchesSearch =
        searchQuery === "" ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tid?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesSku = skuFilter === "" || item.sku.toLowerCase().includes(skuFilter.toLowerCase())
      const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter
      const matchesDesc = descFilter === "" || item.description.toLowerCase().includes(descFilter.toLowerCase())
      return matchesSearch && matchesSku && matchesCategory && matchesDesc
    })
  }, [stockDb, searchQuery, skuFilter, categoryFilter, descFilter])

  return (
    <div className="space-y-3 md:space-y-4">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-foreground">Stock Overview</h2>
        <p className="text-muted-foreground text-xs md:text-sm">
          Current inventory by SKU, based on all registered tags.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4 space-y-3">
        {/* Search + View Toggle + Download */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full lg:max-w-md">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Quick search SKU, Description, TID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 w-full border border-input rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none bg-background"
            />
          </div>

          {/* View Toggle + Download */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {/* View Toggle */}
            <div className="flex bg-muted p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode("summary")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  viewMode === "summary"
                    ? "bg-background shadow text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                Summary
              </button>
              <button
                onClick={() => setViewMode("detail")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  viewMode === "detail"
                    ? "bg-background shadow text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                Detail
              </button>
            </div>

            {/* Download */}
            <button className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative">
              <Label className="text-xs">SKU</Label>
              <Input
                placeholder="Filter by SKU..."
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
                onFocus={() => setShowSkuSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSkuSuggestions(false), 200)}
                className="h-9 text-sm"
              />
              {showSkuSuggestions && filteredSkuSuggestions.length > 0 && (
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
              <Label className="text-xs">Category</Label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background focus:border-primary outline-none"
              >
                <option value="ALL">All Categories</option>
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
                placeholder="Filter by description..."
                value={descFilter}
                onChange={(e) => setDescFilter(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden min-h-[250px]">
        {viewMode === "summary" ? (
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-left">
              <thead className="bg-primary text-primary-foreground uppercase text-[10px] md:text-xs sticky top-0">
                <tr>
                  <th className="px-3 md:px-4 py-2 md:py-3 font-semibold">SKU</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 font-semibold hidden sm:table-cell">Description</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 font-semibold hidden md:table-cell">Category</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 font-semibold text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSummary.length > 0 ? (
                  filteredSummary.map((row) => (
                    <tr key={row.sku} className="hover:bg-muted/50 transition-colors">
                      <td className="px-3 md:px-4 py-2 md:py-3">
                        <div className="font-bold text-foreground text-xs md:text-sm">{row.sku}</div>
                        <div className="text-[10px] md:text-xs text-muted-foreground sm:hidden truncate max-w-[120px]">
                          {row.description}
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                        <span className="truncate block max-w-[180px]">{row.description}</span>
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 hidden md:table-cell">
                        <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground text-[10px] md:text-xs rounded-full font-medium">
                          {row.category}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-right">
                        <span className="text-lg md:text-xl font-bold text-primary">{row.totalQty}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      <div className="flex flex-col items-center">
                        <PackageX className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">No items found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-left">
              <thead className="bg-primary text-primary-foreground uppercase text-[10px] md:text-xs sticky top-0">
                <tr>
                  <th className="px-3 md:px-4 py-2 md:py-3 font-semibold">SKU</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 font-semibold hidden sm:table-cell">Description</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 font-semibold">TID</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 font-semibold hidden md:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDetail.length > 0 ? (
                  filteredDetail.slice(0, 100).map((item) => (
                    <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-3 md:px-4 py-2">
                        <div className="font-bold text-foreground text-xs md:text-sm">{item.sku}</div>
                        <div className="text-[10px] md:text-xs text-muted-foreground sm:hidden truncate max-w-[100px]">
                          {item.description}
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-2 text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                        <span className="truncate block max-w-[150px]">{item.description}</span>
                      </td>
                      <td className="px-3 md:px-4 py-2 font-mono text-[10px] md:text-xs text-muted-foreground">
                        {item.tid}
                      </td>
                      <td className="px-3 md:px-4 py-2 text-muted-foreground text-xs md:text-sm hidden md:table-cell">
                        {item.createdTime}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      <div className="flex flex-col items-center">
                        <PackageX className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">No items found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
