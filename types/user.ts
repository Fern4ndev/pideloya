import type { Role } from './auth'

/** Corresponde a la tabla public.profiles */
export interface Profile {
  id: string
  authId: string
  role: Role
  fullName: string
  phone: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}