'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'

export function ApproveButton({
  id,
  action,
  label = 'Aprobar',
}: {
  id: string
  action: (id: string) => Promise<{ success: boolean }>
  label?: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(() => { action(id) })}
    >
      {isPending ? 'Aprobando…' : label}
    </Button>
  )
}