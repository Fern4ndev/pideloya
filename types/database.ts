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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          address_text: string
          created_at: string
          customer_id: string | null
          id: string
          label: string | null
          latitude: number
          longitude: number
          reference: string | null
        }
        Insert: {
          address_text: string
          created_at?: string
          customer_id?: string | null
          id?: string
          label?: string | null
          latitude: number
          longitude: number
          reference?: string | null
        }
        Update: {
          address_text?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          label?: string | null
          latitude?: number
          longitude?: number
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          restaurant_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          accepted_at: string | null
          allows_pay_on_delivery: boolean
          cash_collected_at: string | null
          collected_at: string | null
          collected_method: string | null
          created_at: string
          delivered_at: string | null
          delivery_fee: number | null
          delivery_person_id: string | null
          id: string
          offered_at: string | null
          order_id: string
          payment_confirmed_at: string | null
          payment_method: string | null
          payment_timing: string | null
          payment_voucher_path: string | null
          picked_up_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          allows_pay_on_delivery?: boolean
          cash_collected_at?: string | null
          collected_at?: string | null
          collected_method?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number | null
          delivery_person_id?: string | null
          id?: string
          offered_at?: string | null
          order_id: string
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_timing?: string | null
          payment_voucher_path?: string | null
          picked_up_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          allows_pay_on_delivery?: boolean
          cash_collected_at?: string | null
          collected_at?: string | null
          collected_method?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number | null
          delivery_person_id?: string | null
          id?: string
          offered_at?: string | null
          order_id?: string
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_timing?: string | null
          payment_voucher_path?: string | null
          picked_up_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_delivery_person_id_fkey"
            columns: ["delivery_person_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          order_id: string
          product_id: string | null
          product_name: string | null
          quantity: number
          restaurant_id: string
          restaurant_name: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_id: string
          product_id?: string | null
          product_name?: string | null
          quantity: number
          restaurant_id: string
          restaurant_name?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          restaurant_id?: string
          restaurant_name?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_fee: number | null
          id: string
          notes: string | null
          payment_method: string | null
          payment_timing: string | null
          restaurant_paid_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
        }
        Insert: {
          address_id: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_timing?: string | null
          restaurant_paid_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at?: string
        }
        Update: {
          address_id?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_timing?: string | null
          restaurant_paid_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_incidents: {
        Row: {
          created_at: string
          id: string
          kind: string
          note: string | null
          order_id: string
          reported_by: string | null
          reporter_role: Database["public"]["Enums"]["user_role"]
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          order_id: string
          reported_by?: string | null
          reporter_role: Database["public"]["Enums"]["user_role"]
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          order_id?: string
          reported_by?: string | null
          reporter_role?: Database["public"]["Enums"]["user_role"]
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_incidents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_file_id: string | null
          image_url: string | null
          name: string
          price: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_file_id?: string | null
          image_url?: string | null
          name: string
          price: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_file_id?: string | null
          image_url?: string | null
          name?: string
          price?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepts_pay_on_delivery: boolean
          anonymized_at: string | null
          auth_id: string
          avatar_file_id: string | null
          avatar_url: string | null
          created_at: string
          document_number: string | null
          document_type: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          vehicle_type: string | null
          yape_qr_file_id: string | null
          yape_qr_url: string | null
        }
        Insert: {
          accepts_pay_on_delivery?: boolean
          anonymized_at?: string | null
          avatar_file_id?: string | null
          avatar_url?: string | null
          auth_id: string
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          vehicle_type?: string | null
          yape_qr_file_id?: string | null
          yape_qr_url?: string | null
        }
        Update: {
          accepts_pay_on_delivery?: boolean
          anonymized_at?: string | null
          avatar_file_id?: string | null
          avatar_url?: string | null
          auth_id?: string
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          vehicle_type?: string | null
          yape_qr_file_id?: string | null
          yape_qr_url?: string | null
        }
        Relationships: []
      }
      restaurant_hours: {
        Row: {
          close_time: string
          day_of_week: number
          id: string
          is_closed: boolean
          open_time: string
          restaurant_id: string
        }
        Insert: {
          close_time?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          open_time?: string
          restaurant_id: string
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          open_time?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_members: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address_text: string | null
          created_at: string
          description: string | null
          food_type: string | null
          id: string
          is_active: boolean
          is_approved: boolean
          is_open: boolean
          latitude: number | null
          logo_file_id: string | null
          logo_url: string | null
          longitude: number | null
          name: string
          slug: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address_text?: string | null
          created_at?: string
          description?: string | null
          food_type?: string | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          is_open?: boolean
          latitude?: number | null
          logo_file_id?: string | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          slug: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address_text?: string | null
          created_at?: string
          description?: string | null
          food_type?: string | null
          id?: string
          is_active?: boolean
          is_approved?: boolean
          is_open?: boolean
          latitude?: number | null
          logo_file_id?: string | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          slug?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      // Fase 0/C4 del plan de optimización: rate limit de registro público.
      // Firmas manuales — regenerar con `supabase gen types` cuando haya
      // access token disponible.
      registration_attempts: {
        Row: {
          created_at: string
          id: string
          ip: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip: string
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      // Fase 3 del plan de optimización: RPCs agregadas (1 consulta por
      // pantalla). Firmas manuales — regenerar con `supabase gen types`
      // cuando haya access token disponible.
      admin_counts: {
        Args: never
        Returns: {
          total_users: number
          restaurants_pending: number
          restaurants_active: number
          deliveries_pending: number
          deliveries_active: number
          orders_today: number
          payment_incidents_open: number
        }
      }
      admin_dashboard: {
        Args: { p_days?: number }
        Returns: {
          generated_at: string
          restaurants: { id: string; name: string }[]
          delivery_persons: { id: string; full_name: string }[]
          sales_daily: { day: string; n: number }[]
          sales_by_restaurant: { day: string; restaurant_id: string; n: number }[]
          delivered_by_person: { day: string; delivery_person_id: string; n: number }[]
        }
      }
      cancel_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      complete_delivery: {
        // Fase 2: la app manda solo `p_order_id`. La firma vigente de la base
        // sigue siendo (uuid, boolean, text) hasta la migración contract; los
        // parámetros de cobro se aceptan y se IGNORAN (ya no se declara medio).
        Args: { p_order_id: string }
        Returns: undefined
      }
      confirm_delivery_payment: {
        Args: { p_order_id: string; p_voucher_path: string }
        Returns: undefined
      }
      create_order: {
        Args: {
          p_address_id: string
          // El DEFAULT de la función es null; el navegador SIEMPRE manda el
          // client_request_id, los consumidores de la API pueden omitirlo.
          p_notes?: string | null
          p_items: { product_id: string; quantity: number }[]
          p_client_request_id?: string | null
        }
        Returns: string
      }
      current_customer_order_ids: { Args: never; Returns: string[] }
      current_delivery_address_ids: { Args: never; Returns: string[] }
      current_delivery_order_ids: { Args: never; Returns: string[] }
      current_profile_id: { Args: never; Returns: string }
      current_restaurant_ids: { Args: never; Returns: string[] }
      current_role: { Args: never; Returns: string }
      delivery_chart_rows: {
        Args: { p_days?: number }
        Returns: {
          delivered_at: string | null
          delivery_fee: number | null
          status: string | null
        }[]
      }
      delivery_stats: {
        Args: never
        Returns: {
          available_orders: number
          active_deliveries: number
          delivered_today: number
          delivered_total: number
        }[]
      }
      expire_stale_delivery_offers: {
        Args: { p_max_age?: string }
        Returns: number
      }
      get_delivery_offer_details: {
        Args: { p_order_id: string }
        Returns: {
          full_name: string
          avatar_url: string | null
          yape_qr_url: string | null
          phone: string | null
          delivery_fee: number | null
          payment_voucher_path: string | null
        }[]
      }
      my_order_counts: {
        Args: never
        Returns: {
          all_orders: number
          active: number
          delivered: number
          cancelled: number
          pending: number
        }[]
      }
      offer_delivery: {
        Args: { p_order_id: string; p_delivery_fee: number }
        Returns: undefined
      }
      pickup_delivery: {
        Args: { p_order_id: string; p_restaurant_paid?: boolean }
        Returns: undefined
      }
      pending_order_address_ids: { Args: never; Returns: string[] }
      report_payment_incident: {
        Args: { p_order_id: string; p_kind: string; p_note?: string }
        Returns: string
      }
      restaurant_chart_items: {
        Args: { p_days?: number }
        Returns: {
          order_id: string
          product_name: string | null
          quantity: number
          unit_price: number
          created_at: string
        }[]
      }
      restaurant_stats: {
        Args: never
        Returns: {
          total_products: number
          available_products: number
          total_categories: number
          orders_this_week: number
        }[]
      }
      retract_delivery_offer: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      select_delivery_payment: {
        // `p_method` pasa a ser OPCIONAL (compatibilidad legacy): con
        // ON_DELIVERY el método no se envía y la función lo guarda NULL.
        Args: {
          p_order_id: string
          p_method?: string
          p_voucher_path?: string
          p_timing?: string
        }
        Returns: undefined
      }
      start_route: {
        Args: { p_order_id: string }
        Returns: undefined
      }
    }
    Enums: {
      order_status:
        | "PENDING"
        | "AWAITING_PAYMENT"
        | "ASSIGNED"
        | "PICKED_UP"
        | "ON_THE_WAY"
        | "DELIVERED"
        | "CANCELLED"
      user_role: "CUSTOMER" | "RESTAURANT" | "DELIVERY" | "ADMIN"
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
    Enums: {
      order_status: [
        "PENDING",
        "AWAITING_PAYMENT",
        "ASSIGNED",
        "PICKED_UP",
        "ON_THE_WAY",
        "DELIVERED",
        "CANCELLED",
      ],
      user_role: ["CUSTOMER", "RESTAURANT", "DELIVERY", "ADMIN"],
    },
  },
} as const
