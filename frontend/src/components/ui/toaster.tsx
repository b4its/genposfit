import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <ToastProvider>
      <ToastViewport className="fixed top-4 right-4 z-[100]">
        {toasts.map(({ id, title, description, action, variant, ...props }) => {
          return (
            <Toast key={id} variant={variant} onClose={() => dismiss(id)} {...props}>
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action}
            </Toast>
          )
        })}
      </ToastViewport>
    </ToastProvider>
  )
}
