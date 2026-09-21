'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/db/client'

async function fetchWithAuth(url: string) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  })

  if (!res.ok) throw new Error('Error al cargar pedido')
  return res.json()
}

export function useOrderStatus(orderId: string) {
  const { data, error, isLoading } = useSWR(
    `/api/v1/orders/${orderId}`,
    fetchWithAuth,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  )

  return {
    status: data?.data?.status as string | undefined,
    error,
    isLoading,
  }
}
