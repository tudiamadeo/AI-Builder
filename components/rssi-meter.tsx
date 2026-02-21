'use client'

import { useMemo } from 'react'

interface RssiMeterProps {
  rssiDbm?: number
  label?: string
}

export function RssiMeter({ rssiDbm, label = 'Signal Strength' }: RssiMeterProps) {
  // Normalize RSSI dBm (-90 to -30) to 0-100 scale
  const normalized = useMemo(() => {
    if (rssiDbm === undefined || rssiDbm === null) return 0
    const clamped = Math.max(-90, Math.min(-30, rssiDbm))
    return Math.round((clamped + 90) / 0.6)
  }, [rssiDbm])

  // Determine signal label and color
  const getSignalInfo = (value: number) => {
    if (value < 25) return { label: 'Weak', color: 'text-destructive', bgColor: 'bg-destructive/20' }
    if (value < 50) return { label: 'Fair', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-950' }
    if (value < 75) return { label: 'Good', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-950' }
    return { label: 'Strong', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-950' }
  }

  const signalInfo = getSignalInfo(normalized)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className={`text-2xl font-bold ${signalInfo.color}`}>{normalized}</p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ${signalInfo.color.replace('text-', 'bg-')}`}
          style={{ width: `${normalized}%` }}
        />
      </div>

      {/* Signal label */}
      <div className={`px-3 py-2 rounded-lg text-center text-sm font-medium ${signalInfo.color} ${signalInfo.bgColor}`}>
        {signalInfo.label} Signal
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground text-center">
        RSSI is a signal strength indicator (higher = closer)
      </p>

      {/* Raw RSSI value */}
      {rssiDbm !== undefined && (
        <p className="text-xs text-muted-foreground text-center font-mono">
          {rssiDbm} dBm
        </p>
      )}
    </div>
  )
}
