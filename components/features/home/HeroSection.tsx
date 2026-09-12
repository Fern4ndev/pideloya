import { Icon } from '@iconify-icon/react'
import { ChevronRightIcon } from "@animateicons/react/huge";

export function HeroSection() {
  return (
    <section className="hero-section" aria-label="Presentación">
      <div className="hero-blob hero-blob-coral" />
      <div className="hero-blob hero-blob-violet" />

      <div className="hero-ring hero-ring-one" />
      <div className="hero-ring hero-ring-two" />

      <div className="relative z-10">
        <div className="hero-kicker">
          <span />
          Entregando ahora en tu ciudad
        </div>

        <h1 className="hero-title">
          Tu antojo
          <br />
          <span className="hero-stroke">no espera.</span>
          <br />
          <span className="text-lime">PideloYa.</span>
        </h1>

        <p className="hero-description">
          Comida, mercado, farmacia y hasta lo que se te ocurra. Mensajeros
          locales, seguimiento en vivo y entrega promedio de 12 minutos.
        </p>

        <div className="hero-search">
          <div className="flex min-w-0 flex-1 items-center">
            <Icon
              icon="mdi:map-marker-outline"
              className="ml-3 shrink-0 text-xl text-[#9b978c]"
            />

            <input
              type="text"
              placeholder="¿Dónde te lo llevamos?"
              className="min-w-0 flex-1"
            />
          </div>

          <button type="button" className="button-coral">
            <span>Pide ya</span>
            <ChevronRightIcon
              size={24}
              duration={1.5}
              color="#ffffff"
            />
          </button>
        </div>

        <div className="hero-stats">
          <div>
            <strong>12 min</strong>
            <span>entrega promedio</span>
          </div>

          <div>
            <strong>2.4k+</strong>
            <span>negocios aliados</span>
          </div>

          <div>
            <strong>4.9★</strong>
            <span>calificación</span>
          </div>
        </div>
      </div>

      <div className="hero-stage">
        <div className="food-card food-card-one">
          <div className="food-visual food-burger">
            <div className="burger-bun burger-top" />
            <div className="burger-cheese" />
            <div className="burger-patty" />
            <div className="burger-cheese burger-bottom" />
            <div className="burger-bun" />
          </div>
        </div>

        <div className="food-card food-card-two">
          <div className="food-visual food-box">
            <div className="food-circle" />
            <div className="food-circle-small" />
          </div>
        </div>

        <div className="food-card food-card-three">
          <div className="food-visual food-drink">
            <div className="drink-lid" />
            <div className="drink-body">
              <span />
              <span />
            </div>
          </div>
        </div>

        <div className="floating-tag tag-discount">🔥 20% off hoy</div>
        <div className="floating-tag tag-time">⚡ Llega en 8 min</div>
        <div className="floating-tag tag-delivery">🛵 Marco está en camino</div>
      </div>
    </section>
  )
}