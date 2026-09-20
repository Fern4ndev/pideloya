import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FieldError } from './FieldError'

interface FormSelectProps {
  id: string
  label: ReactNode
  value: string
  onValueChange: (value: string | null) => void
  options: string[]
  error: string | null
  touched: boolean
  placeholder?: string
}

export function FormSelect({
  id,
  label,
  value,
  onValueChange,
  options,
  error,
  touched,
  placeholder = 'Selecciona',
}: FormSelectProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium text-neutral-700">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          aria-invalid={touched && !!error}
          className="h-11 rounded-xl border-white/40 bg-white/60 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:border-purple-300/60 focus:bg-white/80 focus:ring-2 focus:ring-purple-500/10 focus:outline-none transition-all duration-200"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="border-white/40 bg-white/90 backdrop-blur-xl">
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-[15px] text-neutral-700 focus:bg-purple-50 focus:text-purple-700">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {touched && <FieldError message={error} />}
    </div>
  )
}
