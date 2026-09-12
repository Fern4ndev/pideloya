'use client'

import { useState } from 'react'
import { updateRestaurantHours } from '@/lib/actions/restaurant-hours'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

type DayHours = {
  dayOfWeek: number
  openTime: string
  closeTime: string
  isClosed: boolean
}

const DAY_NAMES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
]

const DEFAULT_HOURS: DayHours[] = DAY_NAMES.map((_, i) => ({
  dayOfWeek: i,
  openTime: '09:00',
  closeTime: '22:00',
  isClosed: false,
}))

export function RestaurantHoursForm({
  initialHours,
}: {
  initialHours: { day_of_week: number; open_time: string; close_time: string; is_closed: boolean }[]
}) {
  const [hours, setHours] = useState<DayHours[]>(() => {
    if (initialHours.length > 0) {
      return initialHours.map((h) => ({
        dayOfWeek: h.day_of_week,
        openTime: h.open_time,
        closeTime: h.close_time,
        isClosed: h.is_closed,
      }))
    }
    return DEFAULT_HOURS
  })
  const [saving, setSaving] = useState(false)

  const updateDay = (dayOfWeek: number, field: keyof DayHours, value: string | boolean) => {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h))
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateRestaurantHours(hours)
      toast.success('Horarios actualizados correctamente')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">Horarios de atención</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Día</TableHead>
              <TableHead>Apertura</TableHead>
              <TableHead>Cierre</TableHead>
              <TableHead className="text-right">Cerrado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hours.map((day) => (
              <TableRow key={day.dayOfWeek}>
                <TableCell className="font-medium">{DAY_NAMES[day.dayOfWeek]}</TableCell>
                <TableCell>
                  <Input
                    type="time"
                    value={day.openTime}
                    onChange={(e) => updateDay(day.dayOfWeek, 'openTime', e.target.value)}
                    disabled={day.isClosed}
                    className="w-28"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="time"
                    value={day.closeTime}
                    onChange={(e) => updateDay(day.dayOfWeek, 'closeTime', e.target.value)}
                    disabled={day.isClosed}
                    className="w-28"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Switch
                    checked={day.isClosed}
                    onCheckedChange={(checked) => updateDay(day.dayOfWeek, 'isClosed', checked)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar horarios'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
