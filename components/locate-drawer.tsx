'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Volume2, VolumeX, Loader2, AlertCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RssiMeter } from '@/components/rssi-meter'
import { useDeviceConnection } from '@/lib/device-connection-context'
import { useLocateIntent } from '@/lib/locate-intent-context'

export type CandidateTag = {
  epc: string
  tid: string
}

interface LocateDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sku?: string
  description?: string
  category?: string
  candidateTags: CandidateTag[]
  onNavigateToSettings?: () => void
  initialMode?: 'specific-tid' | 'nearest-sku'
  initialTid?: string
}

type Mode = 'specific-tid' | 'nearest-sku'

export function LocateDrawer({
  open,
  onOpenChange,
  sku = 'N/A',
  description = 'N/A',
  category = 'N/A',
  candidateTags = [],
  onNavigateToSettings,
  initialMode = 'specific-tid',
  initialTid,
}: LocateDrawerProps) {
  const { isConnected, latestRead, reads } = useDeviceConnection()
  const { intent } = useLocateIntent()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [selectedTid, setSelectedTid] = useState<string>(initialTid || candidateTags[0]?.tid || '')
  const [isLocating, setIsLocating] = useState(false)
  const [useBeep, setUseBeep] = useState(false)
  const [timeoutCountdown, setTimeoutCountdown] = useState<number | null>(null)
  const [noSignalCountdown, setNoSignalCountdown] = useState<number | null>(null)
  const [hasDetectedSignal, setHasDetectedSignal] = useState(false)

  // Handle 60s auto-timeout
  useEffect(() => {
    if (!isLocating) {
      setTimeoutCountdown(null)
      return
    }

    let countdown = 60
    const interval = setInterval(() => {
      countdown -= 1
      setTimeoutCountdown(countdown)

      if (countdown <= 0) {
        setIsLocating(false)
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isLocating])

  // Handle 10-15s no-signal warning (only in specific mode)
  useEffect(() => {
    if (mode !== 'specific-tid' || !isLocating) {
      setNoSignalCountdown(null)
      setHasDetectedSignal(false)
      return
    }

    const targetTid = selectedTid
    const readsForTid = reads.filter((r) => r.tid === targetTid)

    if (readsForTid.length > 0) {
      setHasDetectedSignal(true)
      setNoSignalCountdown(null)
      return
    }

    if (!hasDetectedSignal && noSignalCountdown === null) {
      setNoSignalCountdown(15)
    }

    if (noSignalCountdown !== null && noSignalCountdown > 0) {
      const timer = setInterval(() => {
        setNoSignalCountdown((prev) => {
          if (prev === null) return null
          if (prev <= 1) {
            clearInterval(timer)
            return null
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [isLocating, selectedTid, reads, mode, hasDetectedSignal, noSignalCountdown])

  // Play beep sound
  const playBeep = (rssi: number) => {
    if (!useBeep) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const now = audioContext.currentTime

      // Normalize RSSI to frequency (higher RSSI = higher frequency)
      const normalized = Math.max(0, Math.min(100, (rssi + 90) / 0.6))
      const frequency = 200 + (normalized / 100) * 400 // 200-600 Hz

      const osc = audioContext.createOscillator()
      const gain = audioContext.createGain()

      osc.connect(gain)
      gain.connect(audioContext.destination)

      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.1, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)

      osc.start(now)
      osc.stop(now + 0.1)
    } catch (err) {
      console.error('[v0] Beep failed:', err)
    }
  }

  // Auto-beep when RSSI updates (only for matching TID in specific mode)
  useEffect(() => {
    if (!isLocating || !useBeep || !displayRssi) return
    playBeep(displayRssi)
  }, [displayRssi, isLocating, useBeep])

  const handleStartLocate = () => {
    if (mode === 'specific' && !selectedTid) {
      alert('Please select a tag to locate.')
      return
    }

    setIsLocating(true)
  }

  const handleStopLocate = () => {
    setIsLocating(false)
  }

  const handleReset = () => {
    setIsLocating(false)
    setTimeoutCountdown(null)
    setSelectedTid(candidateTags[0]?.tid || '')
  }

  // Compute strongest candidate in "nearest-sku" mode
  const getStrongestCandidate = () => {
    if (mode !== 'nearest-sku') return null

    const candidateTids = new Set(candidateTags.map((t) => t.tid))
    let strongest = null
    let strongestRssi = -Infinity

    reads.forEach((read) => {
      if (candidateTids.has(read.tid) && read.rssi > strongestRssi) {
        strongest = read
        strongestRssi = read.rssi
      }
    })

    return strongest
  }

  // Get reads for the selected TID in specific mode
  const readsForSelectedTid = useMemo(() => {
    if (mode !== 'specific-tid') return []
    return reads.filter((r) => r.tid === selectedTid)
  }, [mode, selectedTid, reads])

  // Get latest RSSI for display
  const displayRssi = useMemo(() => {
    if (mode === 'specific-tid') {
      return readsForSelectedTid[readsForSelectedTid.length - 1]?.rssi || null
    }
    return getStrongestCandidate()?.rssi || null
  }, [mode, readsForSelectedTid])

  const currentLocatingTid =
    mode === 'specific-tid' ? selectedTid : getStrongestCandidate()?.tid
  const currentLocatingEpc =
    mode === 'specific-tid'
      ? candidateTags.find((t) => t.tid === selectedTid)?.epc
      : getStrongestCandidate()?.epc

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-300 ${
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-lg shadow-2xl transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        } max-h-[90vh] overflow-y-auto`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground">Locate Item</h3>
            <p className="text-xs text-muted-foreground">{sku} - {description}</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Device Status Panel */}
          <div className="bg-card border border-border rounded-lg p-3 space-y-3">
            <h4 className="font-semibold text-sm">Device Status</h4>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Connection</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>

            {!isConnected && (
              <Button
                onClick={onNavigateToSettings}
                variant="outline"
                className="w-full h-8 text-xs"
              >
                Go to Settings
              </Button>
            )}
          </div>

          {/* Mode Selector */}
          <div className="bg-card border border-border rounded-lg p-3 space-y-2">
            <h4 className="font-semibold text-sm">Locate Mode</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('specific-tid')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                  mode === 'specific-tid'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Specific Tag
              </button>
              <button
                onClick={() => setMode('nearest-sku')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                  mode === 'nearest-sku'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Nearest of SKU
              </button>
            </div>
          </div>

          {/* Tag Selection (Specific Mode) */}
          {mode === 'specific-tid' && (
            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              <Label htmlFor="tag-select" className="text-xs">
                Select Tag
              </Label>
              <select
                id="tag-select"
                value={selectedTid}
                onChange={(e) => setSelectedTid(e.target.value)}
                className="w-full h-8 border border-input rounded-md px-3 text-xs bg-background focus:border-primary outline-none"
                disabled={isLocating}
              >
                <option value="">-- Choose a tag --</option>
                {candidateTags.map((tag) => (
                  <option key={tag.tid} value={tag.tid}>
                    {tag.tid}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Controls */}
          <div className="bg-card border border-border rounded-lg p-3 space-y-2">
            <h4 className="font-semibold text-sm">Controls</h4>
            <div className="flex gap-2">
              {!isLocating ? (
                <Button
                  onClick={handleStartLocate}
                  disabled={!isConnected}
                  className="flex-1 h-8 text-xs"
                >
                  Start Locating
                </Button>
              ) : (
                <Button
                  onClick={handleStopLocate}
                  variant="destructive"
                  className="flex-1 h-8 text-xs"
                >
                  Stop
                </Button>
              )}
              <Button onClick={handleReset} variant="outline" className="flex-1 h-8 text-xs">
                Reset
              </Button>
            </div>

            {isLocating && timeoutCountdown !== null && (
              <div className="text-center p-2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded text-xs font-medium">
                Auto-stop in {timeoutCountdown}s
              </div>
            )}
          </div>

          {/* Beep Control */}
          <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">Audio Beep</p>
              <p className="text-xs text-muted-foreground">Rate increases with signal strength</p>
            </div>
            <button
              onClick={() => setUseBeep(!useBeep)}
              className={`p-2 rounded-lg transition-all ${
                useBeep
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {useBeep ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>

          {/* RSSI Output */}
          {isLocating && (
            <div className="bg-card border border-border rounded-lg p-3 space-y-3">
              <h4 className="font-semibold text-sm">Signal Reading</h4>

              {isConnected ? (
                displayRssi ? (
                  <>
                    <RssiMeter rssiDbm={displayRssi} />

                    <div className="space-y-2 text-xs">
                      {mode === 'specific-tid' ? (
                        <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded text-blue-700 dark:text-blue-300 font-medium">
                          <Search className="w-3 h-3 inline mr-1" />
                          Locked to: {currentLocatingTid}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="p-2 bg-amber-100 dark:bg-amber-950 rounded text-amber-700 dark:text-amber-300 font-medium">
                            Strongest: {currentLocatingTid || 'searching...'}
                          </div>
                          <p className="text-muted-foreground italic">
                            May jump between tags as signal changes
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : mode === 'specific-tid' && !hasDetectedSignal ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Search className="w-4 h-4 animate-pulse" />
                      <span className="text-xs">Searching… no signal detected yet</span>
                    </div>
                    {noSignalCountdown !== null && noSignalCountdown > 0 && (
                      <div className="p-2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded text-xs">
                        <p className="font-medium mb-1">No reads yet ({noSignalCountdown}s)</p>
                        <p>Walk closer, change angle, check nearby shelves</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Searching for tags...</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">Device not connected</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
