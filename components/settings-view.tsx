'use client'

import { useRef, useEffect } from 'react'
import { useDeviceConnection } from '@/lib/device-connection-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertCircle,
  CheckCircle2,
  Wifi,
  WifiOff,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
} from 'lucide-react'

export function SettingsView() {
  const {
    isConnected,
    url,
    setUrl,
    connect,
    disconnect,
    lastError,
    mockMode,
    setMockMode,
    autoConnectEnabled,
    setAutoConnectEnabled,
    logs,
  } = useDeviceConnection()

  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to newest log (logs are newest-first, so scroll to top)
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  const handleConnect = () => {
    if (isConnected) disconnect()
    else connect(url)
  }

  function formatTs(ts: number) {
    return new Date(ts).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground text-xs">Configure your DERAS WebSocket connection</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Left column: Connection config ── */}
        <div className="space-y-4">
          {/* Device Connection */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground">Device Connection</h3>
              <div className="flex items-center gap-1.5">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-green-600">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-medium text-red-600">Disconnected</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="ws-url" className="text-xs font-semibold mb-1 block">
                WebSocket URL
              </Label>
              <Input
                id="ws-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="ws://192.168.1.10:3030"
                className="h-9 text-xs font-mono"
                disabled={isConnected}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: {'ws://<DERAS_BOX_IP>:3030'}
              </p>
            </div>

            <Button
              onClick={handleConnect}
              variant={isConnected ? 'destructive' : 'default'}
              className="w-full h-9 text-xs"
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </Button>

            {lastError && (
              <div className="flex gap-2 p-2.5 bg-destructive/10 text-destructive rounded text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{lastError}</span>
              </div>
            )}

            {isConnected && !lastError && (
              <div className="flex gap-2 p-2.5 bg-green-50 text-green-700 rounded text-xs">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Device connected successfully</span>
              </div>
            )}
          </div>

          {/* Connection Behavior */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <h3 className="font-bold text-sm text-foreground">Connection Behavior</h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Mock Mode</p>
                <p className="text-xs text-muted-foreground">Simulate RFID reads for testing</p>
              </div>
              <button
                onClick={() => setMockMode(!mockMode)}
                className={`px-3 py-1 rounded border text-xs font-semibold transition-all ${
                  mockMode
                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : 'bg-muted border-border text-muted-foreground'
                }`}
              >
                {mockMode ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <p className="text-xs font-medium text-foreground">Auto-Connect on Load</p>
                <p className="text-xs text-muted-foreground">Reconnect when app starts</p>
              </div>
              <button
                onClick={() => setAutoConnectEnabled(!autoConnectEnabled)}
                className={`px-3 py-1 rounded border text-xs font-semibold transition-all ${
                  autoConnectEnabled
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-muted border-border text-muted-foreground'
                }`}
              >
                {autoConnectEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right column: System log ── */}
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col" style={{ minHeight: 420 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-foreground">System Log</h3>
            <span className="text-xs text-muted-foreground">{logs.length} events</span>
          </div>

          <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1 custom-scrollbar">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-xs font-sans">
                No events yet. Connect to the device to start seeing logs.
              </p>
            ) : (
              logs.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex gap-2 px-2 py-1 rounded text-[11px] leading-tight ${
                    entry.direction === 'sent'
                      ? 'bg-blue-50 text-blue-900'
                      : entry.ok === false
                        ? 'bg-red-50 text-red-800'
                        : 'bg-muted text-foreground'
                  }`}
                >
                  {/* Direction icon */}
                  <span className="flex-shrink-0 mt-0.5">
                    {entry.direction === 'sent' ? (
                      <ArrowUpRight className="w-3 h-3 text-blue-500" />
                    ) : (
                      <ArrowDownLeft
                        className={`w-3 h-3 ${entry.ok === false ? 'text-red-500' : 'text-green-600'}`}
                      />
                    )}
                  </span>

                  {/* Timestamp */}
                  <span className="text-muted-foreground flex-shrink-0 w-[84px]">
                    {formatTs(entry.timestamp)}
                  </span>

                  {/* Event name */}
                  <span className="font-semibold flex-shrink-0 w-[160px] truncate">{entry.event}</span>

                  {/* Status code */}
                  {entry.statusCode !== undefined && (
                    <span
                      className={`flex-shrink-0 px-1 rounded ${
                        entry.statusCode === 1 ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      [{entry.statusCode}]
                    </span>
                  )}

                  {/* Raw preview */}
                  <span className="text-muted-foreground truncate flex-1 min-w-0">
                    {entry.raw.length > 120 ? entry.raw.slice(0, 120) + '…' : entry.raw}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
