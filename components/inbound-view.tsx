'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus,
  Upload,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Trash2,
  X,
  Radio,
  ArrowRight,
  ChevronLeft,
  Loader2,
  WifiOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDeviceConnection } from '@/lib/device-connection-context'
import type { DerasRead } from '@/lib/use-deras-websocket'

// ── Types ──────────────────────────────────────────────────────────────────────

type InboundLine = {
  id: string
  no_sku: string
  description: string
  plannedQty: number
}

type ScannedTag = {
  tid: string
  epc: string
  rssi: number
  antenna: string
  rfid_valid: string
  scannedAt: number
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

type Step = 'prepare' | 'scan' | 'confirm'

// ── Component ──────────────────────────────────────────────────────────────────

export function InboundView() {
  const { isConnected, sendMessage, reads, logs } = useDeviceConnection()

  // ── Step state ──
  const [step, setStep] = useState<Step>('prepare')

  // ── Step 1: Prepare inbound lines ──
  const [lines, setLines] = useState<InboundLine[]>([])
  const [formSku, setFormSku] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formQty, setFormQty] = useState('')
  const [activeLine, setActiveLine] = useState<InboundLine | null>(null)

  // ── Step 2: Scanning ──
  const [isScanning, setIsScanning] = useState(false)
  const [scannedTags, setScannedTags] = useState<ScannedTag[]>([])
  const seenTidsRef = useRef<Set<string>>(new Set())
  const lastReadsLengthRef = useRef(0)

  // ── Step 3: Upload ──
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadMessage, setUploadMessage] = useState('')

  // ── Watch incoming reads while scanning ──
  useEffect(() => {
    if (!isScanning) return
    if (reads.length === lastReadsLengthRef.current) return

    // Process only new reads (reads is newest-first)
    const newReads = reads.slice(0, reads.length - lastReadsLengthRef.current)
    lastReadsLengthRef.current = reads.length

    newReads.forEach((r) => {
      if (seenTidsRef.current.has(r.tid)) return
      seenTidsRef.current.add(r.tid)

      const tag: ScannedTag = {
        tid: r.tid,
        epc: r.epc,
        rssi: r.rssi,
        antenna: r.antenna,
        rfid_valid: r.rfid_valid,
        scannedAt: r.timestamp,
      }
      setScannedTags((prev) => [tag, ...prev])
    })
  }, [reads, isScanning])

  // ── Watch logs for scan-rfid-on confirmation ──
  useEffect(() => {
    if (!isScanning) return
    const latest = logs[0]
    if (!latest) return
    if (
      latest.direction === 'received' &&
      latest.event === 'response-scan-rfid-off' &&
      latest.statusCode === 1
    ) {
      setIsScanning(false)
    }
  }, [logs, isScanning])

  // ── Add inbound line ──
  function addLine() {
    if (!formSku.trim() || !formDesc.trim() || !formQty) return
    const qty = parseInt(formQty, 10)
    if (isNaN(qty) || qty < 1) return
    setLines((prev) => [
      ...prev,
      { id: Date.now().toString(), no_sku: formSku.trim(), description: formDesc.trim(), plannedQty: qty },
    ])
    setFormSku('')
    setFormDesc('')
    setFormQty('')
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  // ── Start scanning for a line ──
  function startScanForLine(line: InboundLine) {
    if (!isConnected) return
    setActiveLine(line)
    setScannedTags([])
    seenTidsRef.current.clear()
    lastReadsLengthRef.current = reads.length
    setStep('scan')
    setIsScanning(true)
    sendMessage({ event: 'scan-rfid-on' })
  }

  // ── Stop scanning ──
  function stopScan() {
    sendMessage({ event: 'scan-rfid-off' })
    setIsScanning(false)
  }

  // ── Remove a scanned tag ──
  function removeTag(tid: string) {
    setScannedTags((prev) => prev.filter((t) => t.tid !== tid))
    seenTidsRef.current.delete(tid)
  }

  // ── Proceed to confirm ──
  function proceedToConfirm() {
    if (isScanning) stopScan()
    setStep('confirm')
  }

  // ── Upload bulk ──
  async function uploadBulk() {
    if (!activeLine || scannedTags.length === 0) return
    setUploadStatus('uploading')

    const payload = {
      event: 'db-storage-insert-rfid-list-bulk',
      value: scannedTags.map((tag) => ({
        tid: tag.tid,
        epc: tag.epc,
        status: 1,
        category: 0,
        description: activeLine.description,
        no_sku: activeLine.no_sku,
        flag_alarm: 1,
      })),
    }

    const sent = sendMessage(payload)
    if (!sent) {
      setUploadStatus('error')
      setUploadMessage('Not connected. Please connect to the device first.')
      return
    }

    // Wait for response event in logs (poll for up to 5s)
    const deadline = Date.now() + 5000
    const poll = setInterval(() => {
      const responseLog = logs.find(
        (l) =>
          l.direction === 'received' &&
          l.event === 'response-db-storage-insert-rfid-list-bulk' &&
          l.timestamp > Date.now() - 6000,
      )
      if (responseLog) {
        clearInterval(poll)
        if (responseLog.statusCode === 1) {
          setUploadStatus('success')
          setUploadMessage(`${scannedTags.length} tags registered under SKU "${activeLine.no_sku}".`)
          // Mark line as done by removing it from the list
          setLines((prev) => prev.filter((l) => l.id !== activeLine.id))
        } else {
          setUploadStatus('error')
          setUploadMessage('Server returned an error. Check the system log.')
        }
        return
      }
      if (Date.now() > deadline) {
        clearInterval(poll)
        setUploadStatus('error')
        setUploadMessage('No response from device within 5 seconds. Check system log.')
      }
    }, 200)
  }

  // ── Reset to prepare another scan ──
  function resetToScan() {
    setStep('scan')
    setScannedTags([])
    seenTidsRef.current.clear()
    lastReadsLengthRef.current = reads.length
    setUploadStatus('idle')
    setUploadMessage('')
    setIsScanning(true)
    sendMessage({ event: 'scan-rfid-on' })
  }

  function backToPrepare() {
    if (isScanning) stopScan()
    setStep('prepare')
    setActiveLine(null)
    setScannedTags([])
    seenTidsRef.current.clear()
    setUploadStatus('idle')
    setUploadMessage('')
  }

  // ── Valid / invalid counts ──
  const validTags = scannedTags.filter((t) => t.rfid_valid === '1')
  const invalidTags = scannedTags.filter((t) => t.rfid_valid !== '1')

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        {step !== 'prepare' && (
          <button
            onClick={backToPrepare}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <div>
          <h2 className="text-lg font-bold text-foreground">Inbound — Register RFID Tags</h2>
          <p className="text-xs text-muted-foreground">
            {step === 'prepare' && 'Step 1 of 3 — Prepare SKU list'}
            {step === 'scan' && `Step 2 of 3 — Scanning for SKU: ${activeLine?.no_sku}`}
            {step === 'confirm' && `Step 3 of 3 — Confirm & Upload for SKU: ${activeLine?.no_sku}`}
          </p>
        </div>
      </div>

      {/* ── Step breadcrumb ── */}
      <div className="flex items-center gap-0">
        {(['prepare', 'scan', 'confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors ${
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <span className="w-4 h-4 rounded-full border text-[10px] flex items-center justify-center flex-shrink-0 border-current">
                {i + 1}
              </span>
              {s === 'prepare' ? 'Prepare' : s === 'scan' ? 'Scan Tags' : 'Confirm & Upload'}
            </div>
            {i < 2 && <ArrowRight className="w-3 h-3 text-muted-foreground mx-1" />}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 1 — PREPARE
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'prepare' && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Add line form */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add SKU Line
              </h3>

              <div>
                <Label htmlFor="ib-sku" className="text-xs font-semibold mb-1 block">
                  SKU / No. SKU
                </Label>
                <Input
                  id="ib-sku"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  placeholder="e.g. WALL-MAGNUM-RED"
                  className="h-9 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && addLine()}
                />
              </div>

              <div>
                <Label htmlFor="ib-desc" className="text-xs font-semibold mb-1 block">
                  Description
                </Label>
                <Input
                  id="ib-desc"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. Kerah Luar Test 1"
                  className="h-9 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && addLine()}
                />
              </div>

              <div>
                <Label htmlFor="ib-qty" className="text-xs font-semibold mb-1 block">
                  Planned Qty
                </Label>
                <Input
                  id="ib-qty"
                  type="number"
                  min={1}
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                  placeholder="0"
                  className="h-9 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && addLine()}
                />
              </div>

              <Button
                onClick={addLine}
                className="w-full h-9 text-xs"
                disabled={!formSku || !formDesc || !formQty}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add to List
              </Button>
            </div>

            {/* Connection notice */}
            {!isConnected && (
              <div className="mt-3 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Not connected. Go to Settings to connect to the DERAS device before scanning.</span>
              </div>
            )}
          </div>

          {/* Inbound list table */}
          <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">Inbound List</h3>
                <p className="text-xs text-muted-foreground">{lines.length} SKU lines ready</p>
              </div>
            </div>

            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-primary text-primary-foreground text-xs uppercase sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">No. SKU</th>
                    <th className="px-4 py-2.5 font-semibold">Description</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Planned Qty</th>
                    <th className="px-4 py-2.5 font-semibold text-center w-24">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-muted-foreground text-xs">
                        No lines added yet. Use the form on the left to add SKUs.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line) => (
                      <tr key={line.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-foreground">
                          {line.no_sku}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{line.description}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-base font-bold text-primary">{line.plannedQty}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              onClick={() => startScanForLine(line)}
                              disabled={!isConnected}
                              className="h-7 px-3 text-xs"
                            >
                              <Radio className="w-3 h-3 mr-1" />
                              Scan
                            </Button>
                            <button
                              onClick={() => removeLine(line.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 2 — SCAN
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'scan' && activeLine && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Control panel */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-3">
            {/* Active SKU info */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                Scanning for
              </p>
              <p className="font-mono font-bold text-primary text-base">{activeLine.no_sku}</p>
              <p className="text-xs text-foreground">{activeLine.description}</p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Planned:</span>
                <span className="font-bold text-sm text-foreground">{activeLine.plannedQty}</span>
                <span className="text-xs text-muted-foreground ml-2">Scanned:</span>
                <span
                  className={`font-bold text-sm ${
                    scannedTags.length >= activeLine.plannedQty ? 'text-green-600' : 'text-primary'
                  }`}
                >
                  {scannedTags.length}
                </span>
              </div>
            </div>

            {/* Scan progress bar */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Progress</span>
                <span className="text-muted-foreground">
                  {scannedTags.length} / {activeLine.plannedQty}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    scannedTags.length >= activeLine.plannedQty ? 'bg-green-500' : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.min(100, (scannedTags.length / activeLine.plannedQty) * 100)}%`,
                  }}
                />
              </div>
              {scannedTags.length >= activeLine.plannedQty && (
                <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Target reached
                </p>
              )}
            </div>

            {/* Controls */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              {isScanning ? (
                <Button
                  onClick={stopScan}
                  variant="destructive"
                  className="w-full h-10 text-sm"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Scan
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setIsScanning(true)
                    lastReadsLengthRef.current = reads.length
                    sendMessage({ event: 'scan-rfid-on' })
                  }}
                  className="w-full h-10 text-sm"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Resume Scan
                </Button>
              )}
              <Button
                onClick={proceedToConfirm}
                variant="outline"
                className="w-full h-10 text-sm border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                disabled={scannedTags.length === 0}
              >
                Proceed to Confirm ({scannedTags.length} tags)
              </Button>
            </div>

            {/* Status indicator */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                isScanning
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              {isScanning ? (
                <>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                  RFID scanning active...
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-muted-foreground rounded-full flex-shrink-0" />
                  Scanner paused
                </>
              )}
            </div>

            {/* Tag validity summary */}
            {scannedTags.length > 0 && (
              <div className="flex gap-2">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-700">{validTags.length}</p>
                  <p className="text-[10px] text-green-600">Valid</p>
                </div>
                {invalidTags.length > 0 && (
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-red-700">{invalidTags.length}</p>
                    <p className="text-[10px] text-red-600">Invalid</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scanned tag list */}
          <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-bold text-sm text-foreground">Scanned Tags</h3>
              <p className="text-xs text-muted-foreground">
                Deduplicated by TID — {scannedTags.length} unique tags
              </p>
            </div>

            <div className="overflow-auto flex-1 max-h-[480px] custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-primary text-primary-foreground uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="px-4 py-2 font-semibold">#</th>
                    <th className="px-4 py-2 font-semibold">TID</th>
                    <th className="px-4 py-2 font-semibold hidden md:table-cell">EPC</th>
                    <th className="px-4 py-2 font-semibold text-center">RSSI</th>
                    <th className="px-4 py-2 font-semibold text-center">Ant</th>
                    <th className="px-4 py-2 font-semibold text-center">Valid</th>
                    <th className="px-4 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {scannedTags.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-muted-foreground font-sans">
                        {isScanning ? 'Waiting for tags...' : 'No tags scanned. Press Resume Scan.'}
                      </td>
                    </tr>
                  ) : (
                    scannedTags.map((tag, i) => (
                      <tr
                        key={tag.tid}
                        className={`transition-colors hover:bg-muted/40 ${
                          tag.rfid_valid !== '1' ? 'bg-red-50/50' : ''
                        }`}
                      >
                        <td className="px-4 py-2 text-muted-foreground">{scannedTags.length - i}</td>
                        <td className="px-4 py-2 text-foreground font-semibold">{tag.tid}</td>
                        <td className="px-4 py-2 text-muted-foreground hidden md:table-cell truncate max-w-[160px]">
                          {tag.epc}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={`font-semibold ${
                              tag.rssi >= -60
                                ? 'text-green-600'
                                : tag.rssi >= -75
                                  ? 'text-yellow-600'
                                  : 'text-red-500'
                            }`}
                          >
                            {tag.rssi}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center text-muted-foreground">{tag.antenna}</td>
                        <td className="px-4 py-2 text-center">
                          {tag.rfid_valid === '1' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mx-auto" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 mx-auto" />
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => removeTag(tag.tid)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP 3 — CONFIRM & UPLOAD
      ══════════════════════════════════════════════════════════════════════ */}
      {step === 'confirm' && activeLine && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Summary panel */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-3">
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-bold text-sm text-foreground">Upload Summary</h3>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. SKU</span>
                  <span className="font-mono font-bold text-foreground">{activeLine.no_sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium text-foreground text-right max-w-[140px] truncate">
                    {activeLine.description}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium text-foreground">0 (Item)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Flag Alarm</span>
                  <span className="font-medium text-foreground">1 (Enabled)</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                  <span className="text-muted-foreground">Total Tags</span>
                  <span className="font-bold text-primary text-base">{scannedTags.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid</span>
                  <span className="font-semibold text-green-600">{validTags.length}</span>
                </div>
                {invalidTags.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invalid</span>
                    <span className="font-semibold text-red-600">{invalidTags.length}</span>
                  </div>
                )}
              </div>

              {invalidTags.length > 0 && (
                <div className="flex gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {invalidTags.length} invalid tag(s) will still be included. Remove them from the
                    list if needed.
                  </span>
                </div>
              )}
            </div>

            {/* DERAS payload preview */}
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                DERAS Event
              </p>
              <pre className="text-[10px] font-mono text-foreground bg-muted rounded p-2 overflow-auto max-h-32 custom-scrollbar">
                {JSON.stringify(
                  {
                    event: 'db-storage-insert-rfid-list-bulk',
                    value: scannedTags.slice(0, 2).map((t) => ({
                      tid: t.tid,
                      status: 1,
                      category: 0,
                      description: activeLine.description,
                      no_sku: activeLine.no_sku,
                      flag_alarm: 1,
                    })),
                  },
                  null,
                  2,
                )}
                {scannedTags.length > 2 ? `\n  ...and ${scannedTags.length - 2} more` : ''}
              </pre>
            </div>

            {/* Upload actions */}
            <div className="space-y-2">
              {uploadStatus === 'idle' && (
                <>
                  <Button
                    onClick={uploadBulk}
                    className="w-full h-10 text-sm"
                    disabled={scannedTags.length === 0 || !isConnected}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload to DERAS ({scannedTags.length} tags)
                  </Button>
                  <Button
                    onClick={() => setStep('scan')}
                    variant="outline"
                    className="w-full h-9 text-xs"
                  >
                    Back to Scan
                  </Button>
                </>
              )}

              {uploadStatus === 'uploading' && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              )}

              {uploadStatus === 'success' && (
                <div className="space-y-2">
                  <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{uploadMessage}</span>
                  </div>
                  <Button
                    onClick={resetToScan}
                    className="w-full h-9 text-xs"
                  >
                    Scan More Tags (Same SKU)
                  </Button>
                  <Button
                    onClick={backToPrepare}
                    variant="outline"
                    className="w-full h-9 text-xs"
                  >
                    Back to Inbound List
                  </Button>
                </div>
              )}

              {uploadStatus === 'error' && (
                <div className="space-y-2">
                  <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{uploadMessage}</span>
                  </div>
                  <Button onClick={() => setUploadStatus('idle')} className="w-full h-9 text-xs">
                    Retry
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Final tag table */}
          <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-bold text-sm text-foreground">Tags to be Registered</h3>
              <p className="text-xs text-muted-foreground">
                Review before uploading. Remove any unwanted tags.
              </p>
            </div>
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-primary text-primary-foreground uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="px-4 py-2 font-semibold">#</th>
                    <th className="px-4 py-2 font-semibold">TID</th>
                    <th className="px-4 py-2 font-semibold hidden md:table-cell">EPC</th>
                    <th className="px-4 py-2 font-semibold text-center">Valid</th>
                    <th className="px-4 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {scannedTags.map((tag, i) => (
                    <tr
                      key={tag.tid}
                      className={`hover:bg-muted/40 transition-colors ${
                        tag.rfid_valid !== '1' ? 'bg-red-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2 font-semibold text-foreground">{tag.tid}</td>
                      <td className="px-4 py-2 text-muted-foreground hidden md:table-cell truncate max-w-[160px]">
                        {tag.epc}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {tag.rfid_valid === '1' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mx-auto" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {uploadStatus === 'idle' && (
                          <button
                            onClick={() => removeTag(tag.tid)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
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
