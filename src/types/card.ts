import type { Database } from '../lib/database.types'

export type Card = Database['public']['Tables']['cards']['Row']
export type CardInput = Database['public']['Tables']['cards']['Insert']
