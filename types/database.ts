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
      addresses: {
        Row: {
          address_text: string
          created_at: string
          customer_id: string
          id: string
          label: string | null
          latitude: number
          longitude: number
          reference: string | null
        }
        Insert: {
          address_text: string
          created_at?: string
          customer_id: string
          id?: string
          label?: string | null
          latitude: number
          longitude: number
          reference?: string | null
        }
        Update: {
          address_text?: string
          created_at?: string
          customer_id?: string
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
          created_at: string
          delivered_at: string | null
          delivery_person_id: string | null
          id: string
          order_id: string
          picked_up_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_person_id?: string | null
          id?: string
          order_id: string
          picked_up_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_person_id?: string | null
          id?: string
          order_id?: string
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
          product_id: string
          product_name: string | null
          quantity: number
          restaurant_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_id: string
          product_id: string
          product_name?: string | null
          quantity: number
          restaurant_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          order_id?: string
          product_id?: string
          product_name?: string | null
          quantity?: number
          restaurant_id?: string
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
          customer_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
        }
        Insert: {
          address_id: string
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at?: string
        }
        Update: {
          address_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
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
          auth_id: string
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
        }
        Insert: {
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
        }
        Update: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_customer_order_ids: { Args: never; Returns: string[] }
      current_delivery_address_ids: { Args: never; Returns: string[] }
      current_delivery_order_ids: { Args: never; Returns: string[] }
      current_profile_id: { Args: never; Returns: string }
      current_restaurant_ids: { Args: never; Returns: string[] }
      current_role: { Args: never; Returns: string }
    }
    Enums: {
      order_status:
        | "PENDING"
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
