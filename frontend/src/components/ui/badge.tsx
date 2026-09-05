import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning"
    | "info"
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variantClasses = {
    default:
      "border-transparent bg-blue-600 text-white shadow-xs hover:bg-blue-700",
    secondary:
      "border-transparent bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
    destructive:
      "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20",
    outline:
      "text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800",
    success:
      "border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border",
    warning:
      "border-amber-500/20 bg-amber-500/15 text-amber-700 dark:text-amber-400 border",
    info:
      "border-blue-500/20 bg-blue-500/15 text-blue-700 dark:text-blue-400 border",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}
