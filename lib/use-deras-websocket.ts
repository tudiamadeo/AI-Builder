'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export type DerasRead = {
  epc: string
  tid: string
  rssi: number
  antenna: string
  timestamp: number
  rfid_valid: string
}

export type DerasLogEntry = {
  id: string
  direction: 'sent' | 'received'
  timestamp: number
  event: string
  raw: string
  statusCode?: number
  ok?: boolean
}

interface UseDerasWebsocketProps {
  mockMode?: boolean
  bufferSize?: number
  logSize?: number
}

export function useDerasWebsocket({
  mockMode = false,
  bufferSize = 500,
  logSize = 200,
}: UseDerasWebsocketProps = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastRead, setLastRead] = useState<DerasRead | null>(null)
  const [reads, setReads] = useState<DerasRead[]>([])
  const [logs, setLogs] = useState<DerasLogEntry[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const mockIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const logIdRef = useRef(0)

  const pushLog = useCallback(
    (entry: Omit<DerasLogEntry, 'id'>) => {
      const id = String(++logIdRef.current)
      setLogs((prev) => [
        { ...entry, id },
        ...prev.slice(0, logSize - 1),
      ])
    },
    [logSize],
  )

  const sendMessage = useCallback(
    (payload: Record<string, unknown>) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return false
      }
      const raw = JSON.stringify(payload)
      wsRef.current.send(raw)
      pushLog({
        direction: 'sent',
        timestamp: Date.now(),
        event: String(payload.event ?? 'unknown'),
        raw,
      })
      return true
    },
    [pushLog],
  )

  const connect = useCallback(
    (url: string) => {
      if (mockMode) {
        setIsConnected(true)
        setLastError(null)
        pushLog({
          direction: 'received',
          timestamp: Date.now(),
          event: 'system',
          raw: '{"event":"system","message":"Mock mode enabled"}',
          ok: true,
        })

        mockIntervalRef.current = setInterval(() => {
          const baseRssi = -65
          const variation = Math.sin(Date.now() / 1000) * 15 + (Math.random() - 0.5) * 10
          const rssi = Math.round(baseRssi + variation)

          const tid = `E280117020000${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}720B5B`
          const epc = `MOCK${Math.random().toString(16).slice(2, 18).toUpperCase()}`

          const raw = JSON.stringify({
            event: 'scan-rfid-result',
            type: 1,
            data: epc,
            data_tid: tid,
            ant: '1',
            rssi: `${Math.max(-90, Math.min(-30, rssi))},7.0`,
            rfid_valid: '1',
          })

          const mockRead: DerasRead = {
            tid,
            epc,
            rssi: Math.max(-90, Math.min(-30, rssi)),
            antenna: '1',
            timestamp: Date.now(),
            rfid_valid: '1',
          }

          setLastRead(mockRead)
          setReads((prev) => [
            mockRead,
            ...prev.slice(0, bufferSize - 1),
          ])
          pushLog({
            direction: 'received',
            timestamp: Date.now(),
            event: 'scan-rfid-result',
            raw,
            ok: true,
          })
        }, 800)

        return
      }

      try {
        if (wsRef.current) {
          wsRef.current.close()
        }
        const ws = new WebSocket(url)

        ws.onopen = () => {
          setIsConnected(true)
          setLastError(null)
          pushLog({
            direction: 'received',
            timestamp: Date.now(),
            event: 'system',
            raw: `{"event":"system","message":"Connected to ${url}"}`,
            ok: true,
          })
        }

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data)
            const eventName: string = payload.event ?? 'unknown'
            const statusCode: number | undefined = payload.statusCode

            pushLog({
              direction: 'received',
              timestamp: Date.now(),
              event: eventName,
              raw: event.data,
              statusCode,
              ok: statusCode === 1 || statusCode === undefined,
            })

            if (eventName === 'scan-rfid-result' && payload.rfid_valid === '1') {
              const rssiStr = payload.rssi || '-50,7.0'
              const rssiMatch = rssiStr.match(/-?\d+/)
              const rssi = rssiMatch ? parseInt(rssiMatch[0], 10) : -50

              const read: DerasRead = {
                epc: payload.data || '',
                tid: payload.data_tid || '',
                rssi,
                antenna: payload.ant || '1',
                timestamp: Date.now(),
                rfid_valid: payload.rfid_valid ?? '1',
              }

              setLastRead(read)
              setReads((prev) => [read, ...prev.slice(0, bufferSize - 1)])
            }
          } catch (err) {
            pushLog({
              direction: 'received',
              timestamp: Date.now(),
              event: 'parse-error',
              raw: event.data,
              ok: false,
            })
          }
        }

        ws.onerror = () => {
          const errorMsg = 'WebSocket connection error'
          setLastError(errorMsg)
          setIsConnected(false)
          pushLog({
            direction: 'received',
            timestamp: Date.now(),
            event: 'error',
            raw: `{"event":"error","message":"${errorMsg}"}`,
            ok: false,
          })
        }

        ws.onclose = () => {
          setIsConnected(false)
          pushLog({
            direction: 'received',
            timestamp: Date.now(),
            event: 'system',
            raw: '{"event":"system","message":"Disconnected"}',
            ok: false,
          })
        }

        wsRef.current = ws
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to connect'
        setLastError(errorMsg)
        setIsConnected(false)
      }
    },
    [mockMode, bufferSize, pushLog],
  )

  const disconnect = useCallback(() => {
    if (mockMode) {
      if (mockIntervalRef.current) {
        clearInterval(mockIntervalRef.current)
        mockIntervalRef.current = null
      }
      setIsConnected(false)
      return
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }, [mockMode])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    lastError,
    lastRead,
    reads,
    logs,
  }
}
