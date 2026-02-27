'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useDerasWebsocket, type DerasRead, type DerasLogEntry } from '@/lib/use-deras-websocket'

interface DeviceConnectionContextType {
  // Connection state
  isConnected: boolean
  url: string
  setUrl: (url: string) => void
  connect: (url?: string) => void
  disconnect: () => void
  lastError: string | null

  // Streaming data
  reads: DerasRead[]
  latestRead: DerasRead | null

  // WebSocket messaging
  sendMessage: (payload: Record<string, unknown>) => boolean

  // System event log
  logs: DerasLogEntry[]

  // Settings
  mockMode: boolean
  setMockMode: (enabled: boolean) => void
  autoConnectEnabled: boolean
  setAutoConnectEnabled: (enabled: boolean) => void
}

const DeviceConnectionContext = createContext<DeviceConnectionContextType | undefined>(undefined)

const STORAGE_KEYS = {
  URL: 'tudi_device_url',
  MOCK_MODE: 'tudi_mock_mode',
  AUTO_CONNECT: 'tudi_auto_connect',
}

export function DeviceConnectionProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState('ws://192.168.1.10:3030')
  const [mockMode, setMockMode] = useState(false)
  const [autoConnectEnabled, setAutoConnectEnabled] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const {
    isConnected,
    connect: wsConnect,
    disconnect: wsDisconnect,
    sendMessage,
    lastError,
    lastRead,
    reads,
    logs,
  } = useDerasWebsocket({ mockMode, bufferSize: 500, logSize: 200 })

  // Load settings from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedUrl = localStorage.getItem(STORAGE_KEYS.URL)
      const savedMockMode = localStorage.getItem(STORAGE_KEYS.MOCK_MODE)
      const savedAutoConnect = localStorage.getItem(STORAGE_KEYS.AUTO_CONNECT)
      if (savedUrl) setUrl(savedUrl)
      if (savedMockMode) setMockMode(JSON.parse(savedMockMode))
      if (savedAutoConnect) setAutoConnectEnabled(JSON.parse(savedAutoConnect))
    } catch {
      // ignore
    } finally {
      setHasLoaded(true)
    }
  }, [])

  // Persist settings
  useEffect(() => {
    if (!hasLoaded || typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEYS.URL, url)
      localStorage.setItem(STORAGE_KEYS.MOCK_MODE, JSON.stringify(mockMode))
      localStorage.setItem(STORAGE_KEYS.AUTO_CONNECT, JSON.stringify(autoConnectEnabled))
    } catch {
      // ignore
    }
  }, [url, mockMode, autoConnectEnabled, hasLoaded])

  // Auto-connect on load
  useEffect(() => {
    if (!hasLoaded || isConnected) return
    if (autoConnectEnabled) wsConnect(url)
  }, [hasLoaded, autoConnectEnabled, isConnected, url, wsConnect])

  return (
    <DeviceConnectionContext.Provider
      value={{
        isConnected,
        url,
        setUrl,
        connect: (connectUrl?: string) => wsConnect(connectUrl ?? url),
        disconnect: wsDisconnect,
        lastError,
        reads,
        latestRead: lastRead,
        sendMessage,
        logs,
        mockMode,
        setMockMode,
        autoConnectEnabled,
        setAutoConnectEnabled,
      }}
    >
      {children}
    </DeviceConnectionContext.Provider>
  )
}

export function useDeviceConnection() {
  const ctx = useContext(DeviceConnectionContext)
  if (!ctx) throw new Error('useDeviceConnection must be used within DeviceConnectionProvider')
  return ctx
}
