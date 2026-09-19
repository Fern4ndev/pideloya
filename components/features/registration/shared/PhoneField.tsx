import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from './FieldError'

interface PhoneFieldProps {
  id: string
  label: ReactNode
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error: string | null
  touched: boolean
}

export function PhoneField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  touched,
}: PhoneFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id} className="text-[13px] font-medium text-zinc-300">
          {label}
        </Label>
        <span className="text-[12px] tabular-nums text-zinc-500">
          {value.length}/9
        </span>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-medium text-zinc-500 select-none">
          +51
        </span>
        <Input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
            onChange(digits)
          }}
          onBlur={onBlur}
          placeholder="987 654 321"
          aria-invalid={touched && !!error}
          className="h-11 w-full pl-12 rounded-lg border-zinc-800 bg-zinc-900/50 text-[15px] text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-0 focus:outline-none transition-colors tabular-nums"
        />
      </div>
      {touched && <FieldError message={error} />}
    </div>
  )
}
