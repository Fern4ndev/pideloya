export function FormFooter() {
  return (
    <p className="text-[13px] text-center text-neutral-400">
      Al registrarte aceptas nuestros{' '}
      <a href="/terminos" className="text-neutral-500 hover:text-neutral-900 transition-colors underline underline-offset-2">
        Términos
      </a>{' '}
      y{' '}
      <a href="/privacidad" className="text-neutral-500 hover:text-neutral-900 transition-colors underline underline-offset-2">
        Privacidad
      </a>
    </p>
  )
}
