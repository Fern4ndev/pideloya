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
        <Label htmlFor={id} className="text-[13px] font-medium text-neutral-700">
          {label}
        </Label>
        <span className="text-[12px] tabular-nums text-neutral-400">
          {value.length}/9
        </span>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-medium text-neutral-400 select-none">
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
          className="h-11 w-full rounded-xl border-white/40 bg-white/60 pl-12 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:border-purple-300/60 focus:bg-white/80 focus:ring-2 focus:ring-purple-500/10 focus:outline-none transition-all duration-200 tabular-nums"
        />
      </div>
      {touched && <FieldError message={error} />}
    </div>
  )
}
