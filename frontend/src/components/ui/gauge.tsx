import * as React from "react"
import { cn } from "@/lib/utils"

export interface GaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  min?: number
  max?: number
  size?: number
  strokeWidth?: number
  showValue?: boolean
  label?: string
  status?: "bagus" | "ringan" | "buruk" | "neutral"
}

export function Gauge({
  value,
  min = 0,
  max = 100,
  size = 140,
  strokeWidth = 10,
  showValue = true,
  label,
  status,
  className,
  ...props
}: GaugeProps) {
  const normalizedValue = Math.min(Math.max(value, min), max)
  const percentage = ((normalizedValue - min) / (max - min)) * 100
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  // Determine status color if not explicitly provided
  const resolvedStatus =
    status || (normalizedValue >= 80 ? "bagus" : normalizedValue >= 60 ? "ringan" : "buruk")

  const strokeColors = {
    bagus: "text-emerald-500",
    ringan: "text-amber-500",
    buruk: "text-rose-500",
    neutral: "text-blue-500",
  }

  const textColors = {
    bagus: "text-emerald-600 dark:text-emerald-400",
    ringan: "text-amber-600 dark:text-amber-400",
    buruk: "text-rose-600 dark:text-rose-400",
    neutral: "text-blue-600 dark:text-blue-400",
  }

  return (
    <div
      className={cn("relative inline-flex flex-col items-center justify-center", className)}
      {...props}
    >
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          className="rotate-[-90deg] transform"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background circle track */}
          <circle
            className="text-slate-100 dark:text-slate-800"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {/* Active progress arc */}
          <circle
            className={cn("transition-all duration-700 ease-out", strokeColors[resolvedStatus])}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>

        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-3xl font-bold tracking-tight font-mono", textColors[resolvedStatus])}>
              {Math.round(normalizedValue)}%
            </span>
            {label && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
