import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from './FieldError'

interface FormFieldProps {
  id: string
  label: ReactNode
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  placeholder?: string
  error: string | null
  touched: boolean
  inputMode?: 'text' | 'numeric'
  counter?: { current: number; max: number }
  type?: string
}

export function FormField({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  touched,
  inputMode,
  counter,
  type = 'text',
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id} className="text-[13px] font-medium text-neutral-700">
          {label}
        </Label>
        {counter && (
          <span className="text-[12px] tabular-nums text-neutral-400">
            {counter.current}/{counter.max}
          </span>
        )}
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={touched && !!error}
        className="h-11 w-full rounded-xl border-white/40 bg-white/60 px-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:border-purple-300/60 focus:bg-white/80 focus:ring-2 focus:ring-purple-500/10 focus:outline-none transition-all duration-200"
      />
      {touched && <FieldError message={error} />}
    </div>
  )
}
