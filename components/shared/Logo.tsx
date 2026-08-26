import Image from 'next/image'

type LogoProps = {
  className?: string
  height?: number
}

export function Logo({ className, height = 60 }: LogoProps) {
  return (
    <>
      <Image
        src="/icons/logo-pideloya-dark.svg"
        alt="PideloYa"
        width={Math.round((220 / 50) * height)}
        height={height}
        className={`block dark:hidden ${className ?? ''}`}
        priority
      />
      <Image
        src="/icons/logo-pideloya.svg"
        alt="PideloYa"
        width={Math.round((220 / 50) * height)}
        height={height}
        className={`hidden dark:block ${className ?? ''}`}
        priority
      />
    </>
  )
}
