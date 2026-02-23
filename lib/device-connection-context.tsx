'use client'

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import { useDerasWebsocket, type DerasRead } from '@/lib/use-deras-websocket'

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

  // Settings
  mockMode: boolean
  setMockMode: (enabled: boolean) => void

  // Auto-connect
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

  const { isConnected, connect: wsConnect, disconnect: wsDisconnect, lastError, lastRead, reads } =
    useDerasWebsocket({
      mockMode,
      bufferSize: 200,
    })

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

      setHasLoaded(true)
    } catch (err) {
      console.error('[v0] Failed to load device settings:', err)
      setHasLoaded(true)
    }
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    if (!hasLoaded || typeof window === 'undefined') return

    try {
      localStorage.setItem(STORAGE_KEYS.URL, url)
      localStorage.setItem(STORAGE_KEYS.MOCK_MODE, JSON.stringify(mockMode))
      localStorage.setItem(STORAGE_KEYS.AUTO_CONNECT, JSON.stringify(autoConnectEnabled))
    } catch (err) {
      console.error('[v0] Failed to save device settings:', err)
    }
  }, [url, mockMode, autoConnectEnabled, hasLoaded])

  // Auto-connect on load
  useEffect(() => {
    if (!hasLoaded || isConnected) return

    if (autoConnectEnabled) {
      console.log('[v0] Auto-connecting to device...')
      wsConnect(url)
    }
  }, [hasLoaded, autoConnectEnabled, isConnected, url, wsConnect])

  const connect = (connectUrl?: string) => {
    const targetUrl = connectUrl || url
    wsConnect(targetUrl)
  }

  const disconnect = () => {
    wsDisconnect()
  }

  return (
    <DeviceConnectionContext.Provider
      value={{
        isConnected,
        url,
        setUrl,
        connect,
        disconnect,
        lastError,
        reads,
        latestRead: lastRead,
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
  const context = useContext(DeviceConnectionContext)
  if (!context) {
    throw new Error('useDeviceConnection must be used within DeviceConnectionProvider')
  }
  return context
}
