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
      <Label htmlFor={id} className="text-[13px] font-medium text-zinc-300">
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
        className="h-11 w-full rounded-lg border-zinc-800 bg-zinc-900/50 text-[15px] text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-0 focus:outline-none transition-colors"
      />
      {touched && <FieldError message={error} />}
    </div>
  )
}
