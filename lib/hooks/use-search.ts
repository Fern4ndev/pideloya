import { create } from 'zustand'

interface SearchState {
  query: string
  setQuery: (query: string) => void
}

/**
 * Estado del buscador de la interfaz de cliente. Vive en memoria (sin
 * persistir) para que el input del navbar (CustomerHeader) y la home
 * (ClienteHomeClient) compartan el mismo término sin pasar props entre
 * el layout y la page.
 */
export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  setQuery: (query) => set({ query }),
}))