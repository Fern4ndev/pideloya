import { createClient } from '@/lib/db/server'
import { DailySalesChart } from './DailySalesChart'
import { TopProductsChart } from './TopProductsChart'
import { DAY_MS, limaDayKey } from '@/lib/dates'

export async function RestaurantDashboardCharts({ todayKey }: { todayKey: string }) {
  const supabase = await createClient()
  const dayStart = Date.parse(`${todayKey}T00:00:00-05:00`)

  const dayKeys: string[] = []
  for (let i = 6; i >= 0; i--) {
    dayKeys.push(limaDayKey(new Date(dayStart - i * DAY_MS)))
  }

  const [salesRes, topRes] = await Promise.all([
    supabase
      .from('order_items')
      .select('created_at, unit_price, quantity')
      .gte('created_at', new Date(dayStart - 8 * DAY_MS).toISOString()),
    supabase
      .from('order_items')
      .select('product_name, quantity')
      .gte('created_at', new Date(dayStart - 30 * DAY_MS).toISOString())
      .limit(1000),
  ])

  const salesByKey = new Map<string, number>(dayKeys.map((key) => [key, 0]))
  for (const item of salesRes.data ?? []) {
    const key = limaDayKey(new Date(item.created_at))
    const current = salesByKey.get(key)
    if (current !== undefined) {
      salesByKey.set(key, current + Number(item.unit_price) * item.quantity)
    }
  }
  const sales = dayKeys.map((date) => ({ date, total: salesByKey.get(date) ?? 0 }))

  const quantityByName = new Map<string, number>()
  for (const item of topRes.data ?? []) {
    const name = item.product_name?.trim() || 'Producto'
    quantityByName.set(name, (quantityByName.get(name) ?? 0) + item.quantity)
  }
  const topProducts = [...quantityByName.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <DailySalesChart data={sales} />
      <TopProductsChart data={topProducts} />
    </div>
  )
}
