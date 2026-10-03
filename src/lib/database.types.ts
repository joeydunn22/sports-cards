export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      card_scans: {
        Row: {
          back_image_path: string | null
          batch_id: string | null
          created_at: string
          error: string | null
          extraction: Json | null
          front_image_path: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          back_image_path?: string | null
          batch_id?: string | null
          created_at?: string
          error?: string | null
          extraction?: Json | null
          front_image_path: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          back_image_path?: string | null
          batch_id?: string | null
          created_at?: string
          error?: string | null
          extraction?: Json | null
          front_image_path?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          back_image_path: string | null
          card_number: string
          cert_number: string | null
          created_at: string
          estimated_value: number | null
          front_image_path: string | null
          grade: string | null
          grade_company: string | null
          id: string
          insert_name: string | null
          is_auto: boolean
          is_graded: boolean
          is_patch: boolean
          is_relic: boolean
          is_rookie: boolean
          parallel: string | null
          player: string
          print_run: number | null
          purchase_date: string | null
          purchase_price: number | null
          quantity: number
          raw_condition: string | null
          serial_number: number | null
          set_name: string
          sold_date: string | null
          sold_price: number | null
          sport: string
          team: string | null
          updated_at: string
          user_id: string
          year: string
        }
        Insert: {
          back_image_path?: string | null
          card_number: string
          cert_number?: string | null
          created_at?: string
          estimated_value?: number | null
          front_image_path?: string | null
          grade?: string | null
          grade_company?: string | null
          id?: string
          insert_name?: string | null
          is_auto?: boolean
          is_graded?: boolean
          is_patch?: boolean
          is_relic?: boolean
          is_rookie?: boolean
          parallel?: string | null
          player: string
          print_run?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          quantity?: number
          raw_condition?: string | null
          serial_number?: number | null
          set_name: string
          sold_date?: string | null
          sold_price?: number | null
          sport: string
          team?: string | null
          updated_at?: string
          user_id?: string
          year: string
        }
        Update: {
          back_image_path?: string | null
          card_number?: string
          cert_number?: string | null
          created_at?: string
          estimated_value?: number | null
          front_image_path?: string | null
          grade?: string | null
          grade_company?: string | null
          id?: string
          insert_name?: string | null
          is_auto?: boolean
          is_graded?: boolean
          is_patch?: boolean
          is_relic?: boolean
          is_rookie?: boolean
          parallel?: string | null
          player?: string
          print_run?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          quantity?: number
          raw_condition?: string | null
          serial_number?: number | null
          set_name?: string
          sold_date?: string | null
          sold_price?: number | null
          sport?: string
          team?: string | null
          updated_at?: string
          user_id?: string
          year?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
