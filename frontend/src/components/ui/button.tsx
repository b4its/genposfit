import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "success"
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default:
        "bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-[0.98] border border-blue-500/20 dark:border-transparent",
      destructive:
        "bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:scale-[0.98]",
      outline:
        "border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 active:scale-[0.98]",
      secondary:
        "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98]",
      ghost:
        "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-[0.98]",
      link: "text-blue-600 dark:text-blue-400 underline-offset-4 hover:underline p-0 h-auto",
      success:
        "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] border border-emerald-500/20 dark:border-transparent",
    }

    const sizeClasses = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-8 rounded-lg px-3 text-xs",
      lg: "h-12 rounded-xl px-6 text-base",
      icon: "h-10 w-10 p-0",
      "icon-sm": "h-8 w-8 p-0 rounded-lg",
    }

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"
