interface FormHeaderProps {
  title: string
  subtitle: string
}

export function FormHeader({ title, subtitle }: FormHeaderProps) {
  return (
    <div className="px-8 pt-10 pb-2">
      <h2 className="text-[28px] font-semibold tracking-tight text-white">
        {title}
      </h2>
      <p className="mt-2 text-[15px] text-zinc-400">
        {subtitle}
      </p>
    </div>
  )
}
