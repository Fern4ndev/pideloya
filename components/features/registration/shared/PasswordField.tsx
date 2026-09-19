import { useState } from 'react'
import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from './FieldError'

interface PasswordFieldProps {
  id: string
  label: ReactNode
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error: string | null
  touched: boolean
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  touched,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium text-zinc-300">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="••••••••"
          aria-invalid={touched && !!error}
          className="h-11 w-full rounded-lg border-zinc-800 bg-zinc-900/50 pr-10 text-[15px] text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-0 focus:outline-none transition-colors"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {visible ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </div>
      {touched && <FieldError message={error} />}
    </div>
  )
}
