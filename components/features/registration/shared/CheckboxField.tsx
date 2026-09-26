import type { ReactNode } from 'react'
import { Checkbox } from '@/components/ui/checkbox'

interface CheckboxFieldProps {
  id: string
  label: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function CheckboxField({
  id,
  label,
  checked,
  onCheckedChange,
}: CheckboxFieldProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 rounded-xl border border-white/40 bg-white/40 p-4 cursor-pointer transition-all duration-200 hover:bg-white/60 hover:border-white/60"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        className="mt-0.5 border-purple-200 data-[state=checked]:border-purple-500 data-[state=checked]:bg-purple-500 data-[state=checked]:text-white"
      />
      <span className="text-[13px] leading-relaxed text-neutral-600 select-none">
        {label}
      </span>
    </label>
  )
}
