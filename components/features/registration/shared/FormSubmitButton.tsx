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
      className="h-12 w-full rounded-lg bg-white text-[15px] font-medium text-black hover:bg-zinc-200 active:bg-zinc-300 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
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
