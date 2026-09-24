import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  // Base UI FieldControl decide "controlado" según si `value` viene definido,
  // y lanza un warning si la prop pasa de `undefined` a un valor (o al revés)
  // a mitad de vida del componente. Si quien consume `Input` pasa
  // `value={undefined}`, lo normalizamos a `''` para que sea establemente
  // controlado. Los usos con `defaultValue` (no pasan `value`) siguen siendo
  // uncontrolled, como hasta ahora.
  const hasExplicitValue = Object.prototype.hasOwnProperty.call(props, "value")
  const value = hasExplicitValue ? (props.value ?? "") : undefined
  const rest = { ...props }
  delete rest.value

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      value={value}
      className={cn(
        "h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-base transition-[color,box-shadow] duration-200 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...rest}
    />
  )
}

export { Input }
