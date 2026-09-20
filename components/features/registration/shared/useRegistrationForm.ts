'use client'

import type { ReactNode } from 'react'
import { useMemo, useState, useTransition, type SubmitEvent } from 'react'

export interface RegistrationFieldConfig {
  name: string
  initialValue: string | boolean
}

export interface RegistrationConfig {
  submitLabel: string
  loadingLabel: string
  fields: Array<{
    name: string
    type: string
    label: ReactNode
    placeholder?: string
    options?: string[]
    inputMode?: 'text' | 'numeric'
    counter?: boolean
    maxLength?: number
  }>
  fieldOrder: string[]
  validate: (field: string, form: Record<string, string | boolean>) => string | null
  onSubmit: (form: Record<string, string | boolean>) => Promise<unknown>
  successTitle: string
  successDescription: string
}

interface UseRegistrationFormOptions {
  fields: RegistrationFieldConfig[]
  onSubmit: (form: Record<string, string | boolean>) => Promise<unknown>
  validate: (field: string, form: Record<string, string | boolean>) => string | null
  fieldOrder: string[]
}

export function useRegistrationForm({
  fields,
  onSubmit,
  validate,
  fieldOrder,
}: UseRegistrationFormOptions) {
  const initialForm = useMemo(() => {
    const obj: Record<string, string | boolean> = {}
    for (const f of fields) obj[f.name] = f.initialValue
    return obj
  }, [fields])

  const initialTouched = useMemo(() => {
    const obj: Record<string, boolean> = {}
    for (const f of fields) obj[f.name] = false
    return obj
  }, [fields])

  const [form, setForm] = useState(initialForm)
  const [touched, setTouched] = useState(initialTouched)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  const errors = useMemo(() => {
    const result: Record<string, string | null> = {}
    for (const field of fieldOrder) {
      result[field] = validate(field, form)
    }
    return result
  }, [form, fieldOrder, validate])

  const isFormValid = fieldOrder.every((field) => errors[field] === null)

  function markTouched(field: string) {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  function markAllTouched() {
    const all: Record<string, boolean> = {}
    for (const f of fields) all[f.name] = true
    setTouched(all)
  }

  function updateField(field: string, value: string | boolean | null) {
    setForm((f) => ({ ...f, [field]: value ?? '' }))
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!isFormValid) {
      markAllTouched()
      setError('Revisa los campos marcados antes de continuar.')
      return
    }

    startTransition(async () => {
      try {
        await onSubmit(form)
        setForm(initialForm)
        setTouched(initialTouched)
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return {
    form,
    touched,
    errors,
    error,
    success,
    showPassword,
    isPending,
    isFormValid,
    markTouched,
    markAllTouched,
    updateField,
    setShowPassword,
    handleSubmit,
  }
}
