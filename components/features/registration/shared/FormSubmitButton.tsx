import { Button } from '@/components/ui/button'

interface FormSubmitButtonProps {
  label: string
  loadingLabel: string
  isPending: boolean
  disabled: boolean
}

export function FormSubmitButton({
  label,
  loadingLabel,
  isPending,
  disabled,
}: FormSubmitButtonProps) {
  return (
    <Button
      type="submit"
      className="mt-8 h-12 w-full rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 text-[15px] font-medium text-white shadow-lg shadow-purple-500/25 transition-all duration-200 hover:from-purple-600 hover:to-violet-600 hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg"
      disabled={disabled}
    >
      {isPending ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </Button>
  )
}
