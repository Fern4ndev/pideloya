'use client'

import { toast as sonnerToast, Toaster as SonnerToaster } from 'sonner'
import type { ExternalToast, ToasterProps } from 'sonner'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react'

const TOAST_DURATION = 4000
const TOAST_VISIBLE = 3

export type ToastVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'loading'

export interface ToastOptions {
  action?: { label: string; onClick: () => void }
  duration?: number
}

function notify(
  variant: ToastVariant,
  title: string,
  description?: string,
  options?: ToastOptions
): string | number {
  const data: ExternalToast = {
    description,
    dismissible: true,
    duration: options?.duration ?? TOAST_DURATION,
  }

  if (options?.action) data.action = options.action

  switch (variant) {
    case 'success':
      return sonnerToast.success(title, data)
    case 'error':
      return sonnerToast.error(title, data)
    case 'warning':
      return sonnerToast.warning(title, data)
    case 'loading':
      return sonnerToast.loading(title, data)
    default:
      return sonnerToast.info(title, data)
  }
}

export function useToast() {
  return {
    success: (title: string, description?: string, options?: ToastOptions) =>
      notify('success', title, description, options),
    error: (title: string, description?: string, options?: ToastOptions) =>
      notify('error', title, description, options),
    warning: (title: string, description?: string, options?: ToastOptions) =>
      notify('warning', title, description, options),
    info: (title: string, description?: string, options?: ToastOptions) =>
      notify('info', title, description, options),
    loading: (title: string, description?: string, options?: ToastOptions) =>
      notify('loading', title, description, options),
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  }
}

export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      visibleToasts={TOAST_VISIBLE}
      gap={12}
      closeButton
      richColors
      duration={TOAST_DURATION}
      containerAriaLabel="Notificaciones"
      icons={{
        success: <CheckCircle2 className="size-5" aria-hidden="true" />,
        error: <AlertCircle className="size-5" aria-hidden="true" />,
        warning: <AlertTriangle className="size-5" aria-hidden="true" />,
        info: <Info className="size-5" aria-hidden="true" />,
        loading: <Loader2 className="size-5 animate-spin" aria-hidden="true" />,
      }}
      toastOptions={{
        closeButtonAriaLabel: 'Cerrar notificación',
        classNames: {
          toast:
            '!rounded-2xl !border !border-border/60 !font-sans !shadow-lg !shadow-black/5 dark:!shadow-black/50 !gap-3 !px-4 !py-3.5',
          title: '!text-[0.9375rem] !font-semibold !leading-snug',
          description: '!mt-1 !text-sm !leading-snug !opacity-85',
          icon: '!size-5',
          closeButton:
            '!rounded-lg !border !border-border/50 !bg-background/70 transition-colors hover:!bg-background focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-lime',
          actionButton:
            '!rounded-full !bg-lime !px-4 !py-1.5 !text-xs !font-bold !text-panel transition-opacity hover:!opacity-90 focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-lime focus-visible:!ring-offset-2',
        },
      }}
      {...props}
    />
  )
}
