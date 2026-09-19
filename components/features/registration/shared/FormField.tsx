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
        <Label htmlFor={id} className="text-[13px] font-medium text-zinc-300">
          {label}
        </Label>
        {counter && (
          <span className="text-[12px] tabular-nums text-zinc-500">
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
        className="h-11 w-full rounded-lg border-zinc-800 bg-zinc-900/50 text-[15px] text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-0 focus:outline-none transition-colors"
      />
      {touched && <FieldError message={error} />}
    </div>
  )
}
