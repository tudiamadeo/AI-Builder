"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Plus, Upload, Printer, Radio, Play, Pause, CheckCircle2, Clock, X, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useInventory } from "@/lib/inventory-context"

type InboundItem = {
  id: string
  sku: string
  description: string
  category: string
  plannedQty: number
  registeredQty: number
  status: "pending" | "in-progress" | "completed" | "partial"
}

type RegistrationMode = "scan" | "print"

export function InboundView() {
  const { addInventoryItems, stockDb } = useInventory()
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)
  const [inboundList, setInboundList] = useState<InboundItem[]>([])
  const registrationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Step 1: Manual Entry Form
  const [manualSku, setManualSku] = useState("")
  const [manualDescription, setManualDescription] = useState("")
  const [manualCategory, setManualCategory] = useState("Apparel")
  const [manualQty, setManualQty] = useState("")

  const [skuFilter, setSkuFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [descFilter, setDescFilter] = useState("")

  // Step 2: Registration
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("scan")
  const [isRegistering, setIsRegistering] = useState(false)
  const [currentItemIndex, setCurrentItemIndex] = useState(0)

  const categories = ["Apparel", "Footwear", "Accessories", "Home", "Electronics"]

  // Add item manually
  const handleAddManualItem = () => {
    if (!manualSku || !manualDescription || !manualQty) return

    const newItem: InboundItem = {
      id: Date.now().toString(),
      sku: manualSku,
      description: manualDescription,
      category: manualCategory,
      plannedQty: Number.parseInt(manualQty),
      registeredQty: 0,
      status: "pending",
    }

    setInboundList([...inboundList, newItem])
    setManualSku("")
    setManualDescription("")
    setManualQty("")
  }

  // Remove item from list
  const handleRemoveItem = (id: string) => {
    setInboundList(inboundList.filter((item) => item.id !== id))
  }

  // Import from Excel
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Mock Excel parsing - in production, use a library like xlsx
    const mockItems: InboundItem[] = [
      {
        id: Date.now().toString() + "-1",
        sku: "APP-JACKET-BLK-L",
        description: "Mens Winter Jacket - Black Size L",
        category: "Apparel",
        plannedQty: 8,
        registeredQty: 0,
        status: "pending",
      },
      {
        id: Date.now().toString() + "-2",
        sku: "FTW-BOOT-BRN-42",
        description: "Mens Leather Boots - Brown Size 42",
        category: "Footwear",
        plannedQty: 5,
        registeredQty: 0,
        status: "pending",
      },
      {
        id: Date.now().toString() + "-3",
        sku: "ACC-SCARF-GRY",
        description: "Wool Scarf - Grey",
        category: "Accessories",
        plannedQty: 12,
        registeredQty: 0,
        status: "pending",
      },
    ]

    setInboundList([...inboundList, ...mockItems])
    e.target.value = ""
  }

  // Start/Stop Registration
  const toggleRegistration = () => {
    if (isRegistering) {
      if (registrationIntervalRef.current) {
        clearInterval(registrationIntervalRef.current)
        registrationIntervalRef.current = null
      }
      setIsRegistering(false)
    } else {
      setIsRegistering(true)
      simulateRegistration()
    }
  }

  const simulateRegistration = () => {
    registrationIntervalRef.current = setInterval(
      () => {
        setInboundList((prev) => {
          const updatedList = [...prev]
          let currentIdx = currentItemIndex

          // Find next item that needs registration
          while (currentIdx < updatedList.length) {
            const item = updatedList[currentIdx]
            if (item.status === "completed" || item.status === "partial") {
              currentIdx++
              continue
            }
            break
          }

          if (currentIdx >= updatedList.length) {
            if (registrationIntervalRef.current) {
              clearInterval(registrationIntervalRef.current)
              registrationIntervalRef.current = null
            }
            setIsRegistering(false)
            return prev
          }

          const currentItem = updatedList[currentIdx]
          setCurrentItemIndex(currentIdx)

          if (currentItem.registeredQty < currentItem.plannedQty) {
            currentItem.registeredQty += 1
            currentItem.status = "in-progress"

            if (currentItem.registeredQty === currentItem.plannedQty) {
              currentItem.status = "completed"

              // Add to inventory
              const newItems = Array.from({ length: currentItem.plannedQty }, (_, i) => ({
                id: `${currentItem.id}-tag-${i}`,
                sku: currentItem.sku,
                description: currentItem.description,
                category: currentItem.category,
                epc: `EPC-${currentItem.sku}-${Date.now()}-${i}`,
                tid: `TID-${currentItem.sku}-${Date.now()}-${i}`,
                createdTime: new Date().toISOString(),
                status: "Active" as const,
                stockCheckHistory: [],
              }))

              addInventoryItems(newItems)
              setCurrentItemIndex(currentIdx + 1)
            }
          }

          return updatedList
        })
      },
      registrationMode === "scan" ? 800 : 400,
    )
  }

  const markAsPartial = (id: string) => {
    setInboundList((prev) =>
      prev.map((item) => {
        if (item.id === id && item.registeredQty > 0 && item.registeredQty < item.plannedQty) {
          // Add registered items to inventory
          const newItems = Array.from({ length: item.registeredQty }, (_, i) => ({
            id: `${item.id}-tag-${i}`,
            sku: item.sku,
            description: item.description,
            category: item.category,
            epc: `EPC-${item.sku}-${Date.now()}-${i}`,
            tid: `TID-${item.sku}-${Date.now()}-${i}`,
            createdTime: new Date().toISOString(),
            status: "Active" as const,
            stockCheckHistory: [],
          }))
          addInventoryItems(newItems)
          return { ...item, status: "partial" as const }
        }
        return item
      }),
    )
  }

  const canProceedToStep2 = inboundList.length > 0

  const filteredInboundList = inboundList.filter((item) => {
    const matchesSku = skuFilter === "" || item.sku.toLowerCase().includes(skuFilter.toLowerCase())
    const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter
    const matchesDesc = descFilter === "" || item.description.toLowerCase().includes(descFilter.toLowerCase())
    return matchesSku && matchesCategory && matchesDesc
  })

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg md:text-xl font-bold text-foreground">Inbound - Register New Items</h2>
        <p className="text-muted-foreground text-xs md:text-sm">
          2-step process: Prepare item data, then register RFID tags.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 md:gap-4">
        <div
          className={`flex items-center gap-1 md:gap-2 ${currentStep === 1 ? "text-primary" : "text-muted-foreground"}`}
        >
          <div
            className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm ${currentStep === 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            1
          </div>
          <span className="font-medium text-xs md:text-sm">Prepare Data</span>
        </div>
        <div className="flex-1 h-0.5 bg-muted"></div>
        <div
          className={`flex items-center gap-1 md:gap-2 ${currentStep === 2 ? "text-primary" : "text-muted-foreground"}`}
        >
          <div
            className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm ${currentStep === 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            2
          </div>
          <span className="font-medium text-xs md:text-sm">Register Tags</span>
        </div>
      </div>

      {/* Step 1: Prepare Data */}
      {currentStep === 1 && (
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Left Side: Manual Entry + Excel Import */}
          <div className="w-full lg:w-[320px] space-y-4 flex-shrink-0">
            {/* Manual Entry */}
            <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4">
              <h3 className="text-sm md:text-base font-bold text-foreground mb-2 md:mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Manual Entry
              </h3>
              <div className="space-y-2 md:space-y-3">
                <div>
                  <Label htmlFor="sku" className="text-xs">
                    SKU
                  </Label>
                  <Input
                    id="sku"
                    value={manualSku}
                    onChange={(e) => setManualSku(e.target.value)}
                    placeholder="e.g. APP-POLO-BLU-L"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="text-xs">
                    Description
                  </Label>
                  <Input
                    id="description"
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    placeholder="e.g. Mens Cotton Polo Shirt"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="category" className="text-xs">
                    Category
                  </Label>
                  <select
                    id="category"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="qty" className="text-xs">
                    Quantity
                  </Label>
                  <Input
                    id="qty"
                    type="number"
                    value={manualQty}
                    onChange={(e) => setManualQty(e.target.value)}
                    placeholder="0"
                    className="h-9 text-sm"
                  />
                </div>
                <Button onClick={handleAddManualItem} className="w-full h-9 text-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add to List
                </Button>
              </div>
            </div>

            {/* Excel Import */}
            <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4">
              <h3 className="text-sm md:text-base font-bold text-foreground mb-2 md:mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Excel Import
              </h3>
              <div className="space-y-2">
                <Label htmlFor="excel-upload" className="cursor-pointer">
                  <div className="flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 px-4 py-2 md:py-3 rounded-lg text-sm font-medium transition-colors border-2 border-dashed border-border">
                    <Upload className="w-4 h-4" />
                    Choose Excel File
                  </div>
                </Label>
                <Input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelImport}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground text-center">Columns: SKU, Description, Category, Qty</p>
              </div>
            </div>
          </div>

          {/* Right Side: Inbound List Table */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
              <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border">
                <h3 className="text-sm md:text-base font-bold text-foreground">Inbound List</h3>
                <p className="text-xs text-muted-foreground">{inboundList.length} items ready for tag registration</p>
              </div>

              <div className="px-3 md:px-4 py-2 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Filters</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder="Filter SKU..."
                    value={skuFilter}
                    onChange={(e) => setSkuFilter(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-8 border border-input rounded-md px-2 text-sm bg-background focus:border-primary outline-none"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Filter Description..."
                    value={descFilter}
                    onChange={(e) => setDescFilter(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="overflow-auto flex-1 max-h-[350px] md:max-h-[400px]">
                <table className="w-full text-left">
                  <thead className="bg-primary text-primary-foreground uppercase text-[10px] md:text-xs sticky top-0">
                    <tr>
                      <th className="px-3 md:px-4 py-2 font-semibold">SKU</th>
                      <th className="px-3 md:px-4 py-2 font-semibold hidden sm:table-cell">Description</th>
                      <th className="px-3 md:px-4 py-2 font-semibold hidden md:table-cell">Category</th>
                      <th className="px-3 md:px-4 py-2 font-semibold text-center">Qty</th>
                      <th className="px-3 md:px-4 py-2 font-semibold text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredInboundList.length > 0 ? (
                      filteredInboundList.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-3 md:px-4 py-2">
                            <div className="font-bold text-foreground text-xs md:text-sm">{item.sku}</div>
                            <div className="text-[10px] md:text-xs text-muted-foreground sm:hidden">
                              {item.description}
                            </div>
                          </td>
                          <td className="px-3 md:px-4 py-2 text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                            {item.description}
                          </td>
                          <td className="px-3 md:px-4 py-2 hidden md:table-cell">
                            <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-3 md:px-4 py-2 text-center">
                            <span className="text-lg md:text-xl font-bold text-primary">{item.plannedQty}</span>
                          </td>
                          <td className="px-3 md:px-4 py-2 text-center">
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
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          <p className="text-sm">No items added yet.</p>
                          <p className="text-xs">Use manual entry or Excel import.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3 md:p-4 border-t border-border bg-muted/30">
                <Button onClick={() => setCurrentStep(2)} disabled={!canProceedToStep2} className="w-full h-10 text-sm">
                  Proceed to Tag Registration ({inboundList.length} items)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Register Tags */}
      {currentStep === 2 && (
        <div className="space-y-4 md:space-y-6">
          {/* Mode Selection */}
          <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4">
            <h3 className="text-sm md:text-base font-bold text-foreground mb-3">Select Registration Mode</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setRegistrationMode("scan")}
                className={`flex-1 flex flex-col items-center gap-2 p-3 md:p-4 border-2 rounded-lg transition-all ${
                  registrationMode === "scan"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <Radio
                  className={`w-6 h-6 ${registrationMode === "scan" ? "text-primary" : "text-muted-foreground"}`}
                />
                <div className="text-center">
                  <div className="font-bold text-foreground text-sm">Scan Tags (Manual Encoding)</div>
                  <div className="text-xs text-muted-foreground">For existing tags on items</div>
                </div>
              </button>
              <button
                onClick={() => setRegistrationMode("print")}
                className={`flex-1 flex flex-col items-center gap-2 p-3 md:p-4 border-2 rounded-lg transition-all ${
                  registrationMode === "print"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <Printer
                  className={`w-6 h-6 ${registrationMode === "print" ? "text-primary" : "text-muted-foreground"}`}
                />
                <div className="text-center">
                  <div className="font-bold text-foreground text-sm">Print & Encode</div>
                  <div className="text-xs text-muted-foreground">Print new tags with data</div>
                </div>
              </button>
            </div>
          </div>

          {/* Registration Table */}
          <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-sm md:text-base font-bold text-foreground">Tag Registration</h3>
                <p className="text-xs text-muted-foreground">
                  Mode: {registrationMode === "scan" ? "Scan Tags" : "Print & Encode"}
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => setCurrentStep(1)}
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-initial text-sm h-9"
                >
                  Back
                </Button>
                {isRegistering ? (
                  <Button
                    onClick={toggleRegistration}
                    variant="destructive"
                    size="sm"
                    className="flex-1 sm:flex-initial text-sm h-9"
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </Button>
                ) : (
                  <Button onClick={toggleRegistration} size="sm" className="flex-1 sm:flex-initial text-sm h-9">
                    <Play className="w-4 h-4 mr-1" />
                    {registrationMode === "scan" ? "Start Scanning" : "Start Printing"}
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-auto max-h-[400px] md:max-h-[450px]">
              <table className="w-full text-left">
                <thead className="bg-primary text-primary-foreground uppercase text-[10px] md:text-xs sticky top-0">
                  <tr>
                    <th className="px-3 md:px-4 py-2 font-semibold">SKU</th>
                    <th className="px-3 md:px-4 py-2 font-semibold hidden sm:table-cell">Description</th>
                    <th className="px-3 md:px-4 py-2 font-semibold text-center">Planned</th>
                    <th className="px-3 md:px-4 py-2 font-semibold text-center">Registered</th>
                    <th className="px-3 md:px-4 py-2 font-semibold text-center">Status</th>
                    <th className="px-3 md:px-4 py-2 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inboundList.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        index === currentItemIndex && isRegistering
                          ? "bg-blue-50 dark:bg-blue-950 ring-2 ring-inset ring-primary"
                          : item.status === "in-progress"
                            ? "bg-amber-50 dark:bg-amber-950"
                            : "hover:bg-muted/50"
                      }`}
                    >
                      <td className="px-3 md:px-4 py-2">
                        <div className="font-bold text-foreground text-xs md:text-sm">{item.sku}</div>
                        <div className="text-[10px] md:text-xs text-muted-foreground sm:hidden">{item.description}</div>
                      </td>
                      <td className="px-3 md:px-4 py-2 text-muted-foreground text-xs md:text-sm hidden sm:table-cell">
                        {item.description}
                      </td>
                      <td className="px-3 md:px-4 py-2 text-center">
                        <span className="text-base md:text-lg font-bold text-foreground">{item.plannedQty}</span>
                      </td>
                      <td className="px-3 md:px-4 py-2 text-center">
                        <span className="text-base md:text-lg font-bold text-primary">{item.registeredQty}</span>
                      </td>
                      <td className="px-3 md:px-4 py-2 text-center">
                        {item.status === "completed" ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-[10px] md:text-xs rounded-full font-medium">
                            <CheckCircle2 className="w-3 h-3 mr-0.5" />
                            <span className="hidden md:inline">Done</span>
                          </span>
                        ) : item.status === "partial" ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px] md:text-xs rounded-full font-medium">
                            <Clock className="w-3 h-3 mr-0.5" />
                            <span className="hidden md:inline">Partial</span>
                          </span>
                        ) : item.status === "in-progress" ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] md:text-xs rounded-full font-medium">
                            <Radio className="w-3 h-3 mr-0.5 animate-pulse" />
                            <span className="hidden md:inline">Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 bg-muted text-muted-foreground text-[10px] md:text-xs rounded-full font-medium">
                            <Clock className="w-3 h-3 mr-0.5" />
                            <span className="hidden md:inline">Pending</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 md:px-4 py-2 text-center">
                        {item.status === "in-progress" && item.registeredQty > 0 && (
                          <Button
                            onClick={() => markAsPartial(item.id)}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                          >
                            Complete Partial
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
