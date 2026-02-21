'use client'

import { useDeviceConnection } from '@/lib/device-connection-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Wifi, WifiOff } from 'lucide-react'

export function SettingsView() {
  const { isConnected, url, setUrl, connect, disconnect, lastError, mockMode, setMockMode, autoConnectEnabled, setAutoConnectEnabled, latestRead } = useDeviceConnection()

  const handleConnect = () => {
    if (isConnected) {
      disconnect()
    } else {
      connect(url)
    }
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <div>
        <h2 className="text-lg md:text-xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground text-xs md:text-sm">
          Configure your RFID device connection
        </p>
      </div>

      {/* Device Connection Card */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm md:text-base text-foreground">Device Connection</h3>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-xs md:text-sm font-medium text-green-600 dark:text-green-400">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400">Disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* WebSocket URL Input */}
        <div>
          <Label htmlFor="ws-url" className="text-xs md:text-sm mb-2 block font-semibold">
            WebSocket URL
          </Label>
          <Input
            id="ws-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ws://192.168.1.10:3030"
            className="h-9 text-xs md:text-sm"
            disabled={isConnected}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Format: ws://DERAS_BOX_IP:3030
          </p>
        </div>

        {/* Connect/Disconnect Button */}
        <Button
          onClick={handleConnect}
          variant={isConnected ? 'destructive' : 'default'}
          className="w-full h-9 text-xs md:text-sm"
        >
          {isConnected ? 'Disconnect' : 'Connect'}
        </Button>

        {/* Error Display */}
        {lastError && (
          <div className="flex gap-2 p-3 bg-destructive/10 text-destructive rounded">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-xs md:text-sm">{lastError}</span>
          </div>
        )}

        {/* Connection Status Success */}
        {isConnected && !lastError && (
          <div className="flex gap-2 p-3 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 rounded">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-xs md:text-sm">Device connected successfully</span>
          </div>
        )}
      </div>

      {/* Connection Behavior Card */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4 space-y-3">
        <h3 className="font-bold text-sm md:text-base text-foreground">Connection Behavior</h3>

        {/* Mock Mode Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs md:text-sm font-medium text-foreground">Mock Mode</p>
            <p className="text-xs text-muted-foreground">Simulate RSSI data for testing</p>
          </div>
          <button
            onClick={() => setMockMode(!mockMode)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              mockMode
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200'
                : 'bg-muted border-border text-muted-foreground'
            }`}
          >
            {mockMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Auto-Connect Toggle */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div>
            <p className="text-xs md:text-sm font-medium text-foreground">Auto-Connect</p>
            <p className="text-xs text-muted-foreground">Reconnect on app load</p>
          </div>
          <button
            onClick={() => setAutoConnectEnabled(!autoConnectEnabled)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              autoConnectEnabled
                ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200'
                : 'bg-muted border-border text-muted-foreground'
            }`}
          >
            {autoConnectEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Live Feed Preview Card */}
      {isConnected && (
        <div className="bg-card border border-border rounded-lg shadow-sm p-3 md:p-4 space-y-3">
          <h3 className="font-bold text-sm md:text-base text-foreground">Live Feed</h3>

          {latestRead ? (
            <div className="space-y-2 text-xs md:text-sm">
              <div className="p-2 bg-muted rounded">
                <p className="text-muted-foreground">EPC</p>
                <p className="font-mono text-foreground truncate">{latestRead.epc}</p>
              </div>
              <div className="p-2 bg-muted rounded">
                <p className="text-muted-foreground">TID</p>
                <p className="font-mono text-foreground truncate">{latestRead.tid}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground">RSSI</p>
                  <p className="font-mono text-foreground">{latestRead.rssi} dBm</p>
                </div>
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground">Antenna</p>
                  <p className="font-mono text-foreground">{latestRead.antenna}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              No reads yet
            </p>
          )}
        </div>
      )}
    </div>
  )
}
