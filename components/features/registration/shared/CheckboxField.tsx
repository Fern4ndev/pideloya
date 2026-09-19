import type { ReactNode } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

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
      className="flex items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-3.5 cursor-pointer transition-colors hover:border-zinc-700/80"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        className="mt-0.5 border-zinc-700 data-[state=checked]:border-zinc-400 data-[state=checked]:bg-white data-[state=checked]:text-black"
      />
      <span className="text-[13px] leading-relaxed text-zinc-400 select-none">
        {label}
      </span>
    </label>
  )
}
