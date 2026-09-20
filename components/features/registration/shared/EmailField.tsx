import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from './FieldError'

interface EmailFieldProps {
  id: string
  label: ReactNode
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error: string | null
  touched: boolean
}

export function EmailField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  touched,
}: EmailFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium text-neutral-700">
        {label}
      </Label>
      <Input
        id={id}
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="correo@ejemplo.com"
        aria-invalid={touched && !!error}
        className="h-11 w-full rounded-xl border-white/40 bg-white/60 px-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:border-purple-300/60 focus:bg-white/80 focus:ring-2 focus:ring-purple-500/10 focus:outline-none transition-all duration-200"
      />
      {touched && <FieldError message={error} />}
    </div>
  )
}
