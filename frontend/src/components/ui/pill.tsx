import * as React from "react"
import { cn } from "@/lib/utils"

export interface PillProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "info" | "outline"
  size?: "sm" | "md"
}

export function Pill({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: PillProps) {
  const variantClasses = {
    default: "border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    destructive: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    outline: "border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-300",
  }

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1.5",
    md: "px-2.5 py-1 text-xs gap-2",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border font-medium transition-colors select-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface PillIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "info"
  pulse?: boolean
}

export function PillIndicator({
  className,
  variant = "default",
  pulse = true,
  ...props
}: PillIndicatorProps) {
  const variantClasses = {
    default: "bg-slate-400 dark:bg-slate-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    destructive: "bg-rose-500",
    info: "bg-blue-500",
  }

  return (
    <span className="relative flex h-2 w-2 items-center justify-center">
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            variantClasses[variant]
          )}
        />
      )}
      <span
        className={cn("relative inline-flex h-2 w-2 rounded-full", variantClasses[variant], className)}
        {...props}
      />
    </span>
  )
}

export function PillContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("truncate leading-none", className)} {...props}>
      {children}
    </span>
  )
}
