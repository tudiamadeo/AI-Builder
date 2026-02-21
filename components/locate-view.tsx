'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { LocateDrawer, type CandidateTag } from '@/components/locate-drawer'
import { useInventory } from '@/lib/inventory-context'
import { useLocateIntent } from '@/lib/locate-intent-context'

type SearchResult = {
  type: 'item' | 'tid'
  sku: string
  description: string
  category: string
  tid: string
  epc: string
}

interface LocateViewProps {
  onNavigateToSettings?: () => void
  clearIntent?: () => void
}

export function LocateView({ onNavigateToSettings, clearIntent }: LocateViewProps = {}) {
  const { stockDb } = useInventory()
  const { intent, clearIntent: clearIntentContext } = useLocateIntent()
  const [searchInput, setSearchInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Handle intent from Stock Check
  useEffect(() => {
    if (!intent) return

    setSelectedItem({
      type: intent.mode === 'specific-tid' ? 'tid' : 'item',
      sku: intent.sku,
      description: intent.description,
      category: intent.category,
      tid: intent.prefillTid || intent.candidateTids[0]?.tid || '',
      epc: intent.candidateTids[0]?.epc || '',
    })

    setDrawerOpen(true)
    // Clear intent after it's been consumed
    clearIntentContext()
  }, [intent, clearIntentContext])

  const searchResults = useMemo(() => {
    if (searchInput.trim().length === 0) return []

    const query = searchInput.toLowerCase()
    const activeItems = stockDb.filter((item) => item.status === 'Active')
    const results: SearchResult[] = []
    const seen = new Set<string>()

    // Search by SKU
    activeItems.forEach((item) => {
      if (item.sku.toLowerCase().includes(query)) {
        const key = `sku-${item.sku}`
        if (!seen.has(key)) {
          results.push({
            type: 'item',
            sku: item.sku,
            description: item.description,
            category: item.category,
            tid: item.tid,
            epc: item.epc,
          })
          seen.add(key)
        }
      }
    })

    // Search by TID
    activeItems.forEach((item) => {
      if (item.tid.toLowerCase().includes(query)) {
        const key = `tid-${item.tid}`
        if (!seen.has(key)) {
          results.push({
            type: 'tid',
            sku: item.sku,
            description: item.description,
            category: item.category,
            tid: item.tid,
            epc: item.epc,
          })
          seen.add(key)
        }
      }
    })

    // Search by EPC
    activeItems.forEach((item) => {
      if (item.epc.toLowerCase().includes(query)) {
        const key = `epc-${item.tid}`
        if (!seen.has(key)) {
          results.push({
            type: 'tid',
            sku: item.sku,
            description: item.description,
            category: item.category,
            tid: item.tid,
            epc: item.epc,
          })
          seen.add(key)
        }
      }
    })

    // Search by Description
    activeItems.forEach((item) => {
      if (item.description.toLowerCase().includes(query)) {
        const key = `desc-${item.sku}`
        if (!seen.has(key)) {
          results.push({
            type: 'item',
            sku: item.sku,
            description: item.description,
            category: item.category,
            tid: item.tid,
            epc: item.epc,
          })
          seen.add(key)
        }
      }
    })

    return results.slice(0, 20)
  }, [searchInput, stockDb])

  const handleSelectResult = (result: SearchResult) => {
    setSelectedItem(result)
    setShowSuggestions(false)
    setDrawerOpen(true)
  }

  // Get candidate tags for the drawer
  const candidateTags: CandidateTag[] = useMemo(() => {
    if (!selectedItem) return []

    if (selectedItem.type === 'tid') {
      // User selected a specific TID, lock to just that
      return [
        {
          tid: selectedItem.tid,
          epc: selectedItem.epc,
        },
      ]
    }

    // User selected a SKU, get all tags for that SKU
    return stockDb
      .filter((item) => item.sku === selectedItem.sku && item.status === 'Active')
      .map((item) => ({
        tid: item.tid,
        epc: item.epc,
      }))
  }, [selectedItem, stockDb])

  return (
    <div className="space-y-3 md:space-y-4">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-foreground">Locate Item</h2>
        <p className="text-muted-foreground text-xs md:text-sm">
          Search for an item by SKU, TID, EPC, or description, then use RSSI to locate it.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4">
        <Label htmlFor="locate-search" className="text-xs md:text-sm mb-2 block font-semibold">
          Search Item
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="locate-search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Search by SKU, TID, EPC, or description..."
            className="pl-9 h-9 text-xs md:text-sm"
          />

          {/* Search Results Dropdown */}
          {showSuggestions && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectResult(result)}
                  className="w-full px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs md:text-sm text-foreground">{result.sku}</div>
                      <div className="text-[10px] md:text-xs text-muted-foreground truncate">{result.description}</div>
                      <div className="flex gap-2 mt-1">
                        <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground text-[9px] md:text-xs rounded font-medium">
                          {result.category}
                        </span>
                        <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground text-[9px] md:text-xs rounded font-mono">
                          {result.tid.substring(0, 12)}...
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showSuggestions && searchInput && searchResults.length === 0 && (
            <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-3">
              <p className="text-xs text-muted-foreground text-center">No items found</p>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {!selectedItem && searchInput === '' && (
        <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
          <p className="text-foreground font-medium mb-1">Search to get started</p>
          <p className="text-xs md:text-sm text-muted-foreground">
            Type a SKU, TID, EPC, or description to find an item
          </p>
        </div>
      )}

      {/* Selected Item Preview */}
      {selectedItem && (
        <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4 space-y-3">
          <h3 className="font-bold text-sm md:text-base text-foreground">Selected Item</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 text-xs md:text-sm">
            <div>
              <p className="text-muted-foreground text-xs">SKU</p>
              <p className="font-mono font-bold">{selectedItem.sku}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">TID</p>
              <p className="font-mono text-xs truncate">{selectedItem.tid}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-muted-foreground text-xs">Description</p>
              <p className="text-xs">{selectedItem.description}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Category</p>
              <span className="inline-block px-2 py-1 bg-muted text-muted-foreground text-xs rounded font-medium">
                {selectedItem.category}
              </span>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">EPC</p>
              <p className="font-mono text-[10px] truncate">{selectedItem.epc}</p>
            </div>
          </div>

          <Button onClick={() => setDrawerOpen(true)} className="w-full h-9 text-sm">
            <MapPin className="w-4 h-4 mr-2" />
            Open Locator
          </Button>
        </div>
      )}

      {/* Locate Drawer */}
      <LocateDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        sku={selectedItem?.sku || 'N/A'}
        description={selectedItem?.description || 'N/A'}
        category={selectedItem?.category || 'N/A'}
        candidateTags={candidateTags}
        onNavigateToSettings={onNavigateToSettings}
      />
    </div>
  )
}
