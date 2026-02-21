'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export type DerasRead = {
  epc: string
  tid: string
  rssi: number
  antenna: string
  timestamp: number
}

interface UseDerasWebsocketProps {
  mockMode?: boolean
  bufferSize?: number
}

export function useDerasWebsocket({ mockMode = false, bufferSize = 200 }: UseDerasWebsocketProps = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastRead, setLastRead] = useState<DerasRead | null>(null)
  const [reads, setReads] = useState<DerasRead[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const mockIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(
    (url: string) => {
      if (mockMode) {
        console.log('[v0] Mock mode enabled - simulating DERAS data')
        setIsConnected(true)
        setLastError(null)

        // Start mock reading
        mockIntervalRef.current = setInterval(() => {
          // Simulate RSSI changing over time
          const baseRssi = -65
          const variation = Math.sin(Date.now() / 1000) * 15 + (Math.random() - 0.5) * 10
          const rssi = Math.round(baseRssi + variation)

          const mockRead: DerasRead = {
            tid: `TID-MOCK-${Math.floor(Math.random() * 1000)}`,
            epc: `EPC-MOCK-${Math.floor(Math.random() * 1000)}`,
            rssi: Math.max(-90, Math.min(-30, rssi)),
            antenna: '1',
            timestamp: Date.now(),
          }

          setLastRead(mockRead)
          setReads((prev) => [...prev.slice(Math.max(0, prev.length - bufferSize + 1)), mockRead])
        }, 500)

        return
      }

      try {
        const ws = new WebSocket(url)

        ws.onopen = () => {
          setIsConnected(true)
          setLastError(null)
          console.log('[v0] WebSocket connected')
        }

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data)

            // Validate DERAS payload
            if (payload.event !== 'scan-rfid-result' || payload.rfid_valid !== '1') {
              return
            }

            // Parse RSSI: format is "-50,7.0", extract first signed number
            const rssiStr = payload.rssi || '-50,7.0'
            const rssiMatch = rssiStr.match(/-?\d+/)
            const rssi = rssiMatch ? parseInt(rssiMatch[0], 10) : -50

            const read: DerasRead = {
              epc: payload.data || '',
              tid: payload.data_tid || '',
              rssi,
              antenna: payload.ant || '1',
              timestamp: Date.now(),
            }

            setLastRead(read)
            setReads((prev) => [...prev.slice(Math.max(0, prev.length - bufferSize + 1)), read])
          } catch (err) {
            console.error('[v0] Failed to parse DERAS message:', err)
          }
        }

        ws.onerror = (err) => {
          const errorMsg = `WebSocket error: ${err.type}`
          setLastError(errorMsg)
          setIsConnected(false)
          console.error('[v0] WebSocket error:', err)
        }

        ws.onclose = () => {
          setIsConnected(false)
          console.log('[v0] WebSocket disconnected')
        }

        wsRef.current = ws
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to connect'
        setLastError(errorMsg)
        setIsConnected(false)
        console.error('[v0] Connection error:', err)
      }
    },
    [mockMode, bufferSize],
  )

  const disconnect = useCallback(() => {
    if (mockMode) {
      if (mockIntervalRef.current) {
        clearInterval(mockIntervalRef.current)
        mockIntervalRef.current = null
      }
      setIsConnected(false)
      console.log('[v0] Mock mode stopped')
      return
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }, [mockMode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    connect,
    disconnect,
    lastError,
    lastRead,
    reads,
  }
}
