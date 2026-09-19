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
      <Label htmlFor={id} className="text-[13px] font-medium text-zinc-300">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          aria-invalid={touched && !!error}
          className="h-11 rounded-lg border-zinc-800 bg-zinc-900/50 text-[15px] text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-0 focus:outline-none transition-colors"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="border-zinc-800 bg-zinc-900">
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-[15px] text-zinc-300 focus:bg-zinc-800 focus:text-white">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {touched && <FieldError message={error} />}
    </div>
  )
}
