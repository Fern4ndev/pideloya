'use client'

import { useRegistrationForm, type RegistrationConfig } from './useRegistrationForm'
import { FormField } from './FormField'
import { FormSelect } from './FormSelect'
import { PasswordField } from './PasswordField'
import { PhoneField } from './PhoneField'
import { EmailField } from './EmailField'
import { CheckboxField } from './CheckboxField'
import { FormError } from './FormError'
import { FormSubmitButton } from './FormSubmitButton'
import { FormSuccessScreen } from './FormSuccessScreen'
import { FormFooter } from './FormFooter'

interface RegistrationFormProps {
  config: RegistrationConfig
}

export function RegistrationForm({ config }: RegistrationFormProps) {
  const {
    form,
    touched,
    errors,
    error,
    success,
    isPending,
    isFormValid,
    markTouched,
    updateField,
    handleSubmit,
  } = useRegistrationForm({
    fields: config.fields.map((f) => ({
      name: f.name,
      initialValue: f.type === 'checkbox' ? false : '',
    })),
    onSubmit: config.onSubmit,
    validate: config.validate,
    fieldOrder: config.fieldOrder,
  })

  if (success) {
    return (
      <FormSuccessScreen
        title={config.successTitle}
        description={config.successDescription}
      />
    )
  }

  return (
    <div className="rounded-3xl border border-white/40 bg-white/50 p-1 shadow-2xl shadow-purple-900/5 backdrop-blur-2xl">
      <form onSubmit={handleSubmit} noValidate className="rounded-[22px] bg-white/70 px-8 py-8 sm:px-10 sm:py-10">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          {config.fields.map((field) => {
            const value = form[field.name]
            const error = errors[field.name] ?? null
            const touchedField = touched[field.name] ?? false

            switch (field.type) {
              case 'text': {
                // Special handling for documentNumber field
                const isDocumentNumber = field.name === 'documentNumber'
                const isDNI = isDocumentNumber && form.documentType === 'DNI'
                const docValue = value as string

                return (
                  <FormField
                    key={field.name}
                    id={field.name}
                    label={field.label}
                    value={docValue}
                    onChange={(v) => {
                      if (isDocumentNumber) {
                        const raw = v
                        const next = isDNI
                          ? raw.replace(/\D/g, '').slice(0, 8)
                          : raw.slice(0, 15)
                        updateField(field.name, next)
                      } else {
                        updateField(field.name, v)
                      }
                    }}
                    onBlur={() => markTouched(field.name)}
                    placeholder={isDNI ? '12345678' : field.placeholder}
                    error={error}
                    touched={touchedField}
                    inputMode={isDNI ? 'numeric' : 'text'}
                    counter={isDocumentNumber && isDNI ? { current: docValue.length, max: 8 } : undefined}
                  />
                )
              }

              case 'email':
                return (
                  <EmailField
                    key={field.name}
                    id={field.name}
                    label={field.label}
                    value={value as string}
                    onChange={(v) => updateField(field.name, v)}
                    onBlur={() => markTouched(field.name)}
                    error={error}
                    touched={touchedField}
                  />
                )

              case 'phone':
                return (
                  <PhoneField
                    key={field.name}
                    id={field.name}
                    label={field.label}
                    value={value as string}
                    onChange={(v) => updateField(field.name, v)}
                    onBlur={() => markTouched(field.name)}
                    error={error}
                    touched={touchedField}
                  />
                )

              case 'password':
                return (
                  <PasswordField
                    key={field.name}
                    id={field.name}
                    label={field.label}
                    value={value as string}
                    onChange={(v) => updateField(field.name, v)}
                    onBlur={() => markTouched(field.name)}
                    error={error}
                    touched={touchedField}
                  />
                )

              case 'select':
                return (
                  <FormSelect
                    key={field.name}
                    id={field.name}
                    label={field.label}
                    value={value as string}
                    onValueChange={(v) => {
                      updateField(field.name, v)
                      markTouched(field.name)
                    }}
                    options={field.options ?? []}
                    error={error}
                    touched={touchedField}
                    placeholder={field.placeholder}
                  />
                )

              case 'checkbox':
                return (
                  <div key={field.name} className="sm:col-span-2">
                    <CheckboxField
                      id={field.name}
                      label={field.label}
                      checked={value as boolean}
                      onCheckedChange={(checked) => {
                        updateField(field.name, checked)
                        markTouched(field.name)
                      }}
                    />
                  </div>
                )

              default:
                return null
            }
          })}
        </div>

        <div className="mt-8 border-t border-purple-100/60 pt-6">
          <FormError message={error} />
        </div>

        <FormSubmitButton
          label={config.submitLabel}
          loadingLabel={config.loadingLabel}
          isPending={isPending}
          disabled={isPending || !isFormValid}
        />

        <div className="mt-4">
          <FormFooter />
        </div>
      </form>
    </div>
  )
}
