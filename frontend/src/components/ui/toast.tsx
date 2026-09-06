import React from "react"
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToastVariant } from "@/hooks/use-toast"

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>
}

type ToastViewportProps = React.HTMLAttributes<HTMLOListElement>

const ToastViewport = React.forwardRef<HTMLOListElement, ToastViewportProps>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn(
        "fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col gap-2.5 p-4 sm:max-w-[420px] pointer-events-none transition-all",
        className
      )}
      {...props}
    />
  )
)
ToastViewport.displayName = "ToastViewport"

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ToastVariant
  onClose?: () => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = "default", onClose, children, ...props }, ref) => {
    const variantStyles: Record<ToastVariant, string> = {
      default:
        "border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 shadow-lg shadow-slate-900/5",
      destructive:
        "border-rose-200 dark:border-rose-800/60 bg-rose-50/95 dark:bg-rose-950/90 text-rose-900 dark:text-rose-100 shadow-lg shadow-rose-950/10",
      success:
        "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-100 shadow-lg shadow-emerald-950/10",
      info:
        "border-blue-200 dark:border-blue-800/60 bg-blue-50/95 dark:bg-blue-950/90 text-blue-900 dark:text-blue-100 shadow-lg shadow-blue-950/10",
      warning:
        "border-amber-200 dark:border-amber-800/60 bg-amber-50/95 dark:bg-amber-950/90 text-amber-900 dark:text-amber-100 shadow-lg shadow-amber-950/10",
    }

    const iconMap: Record<ToastVariant, React.ReactNode> = {
      default: null,
      destructive: <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
      success: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
      info: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />,
      warning: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
    }

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-2xl border p-4 shadow-md backdrop-blur-md transition-all duration-200 animate-in slide-in-from-top-3 fade-in",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        <div className="flex gap-3 min-w-0 flex-1">
          {iconMap[variant]}
          <div className="flex-1 min-w-0 space-y-1">{children}</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors shrink-0"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }
)
Toast.displayName = "Toast"

type ToastTitleProps = React.HTMLAttributes<HTMLHeadingElement>

const ToastTitle = React.forwardRef<HTMLHeadingElement, ToastTitleProps>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("text-sm font-semibold tracking-tight leading-snug", className)}
      {...props}
    />
  )
)
ToastTitle.displayName = "ToastTitle"

type ToastDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>

const ToastDescription = React.forwardRef<HTMLParagraphElement, ToastDescriptionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-xs leading-relaxed opacity-90 break-words", className)}
      {...props}
    />
  )
)
ToastDescription.displayName = "ToastDescription"

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
}
