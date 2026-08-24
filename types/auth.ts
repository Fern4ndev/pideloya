/**
 * Debe coincidir exactamente con el enum `user_role` definido en
 * supabase/migrations/..._create_core_tables.sql
 */
export type Role = 'CUSTOMER' | 'RESTAURANT' | 'DELIVERY' | 'ADMIN'

export interface Session {
  userId: string // auth.users.id (Supabase)
  profileId: string // public.profiles.id
  role: Role
  isActive: boolean
}