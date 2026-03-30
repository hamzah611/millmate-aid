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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      batches: {
        Row: {
          batch_number: string
          created_at: string
          expiry_date: string | null
          id: string
          manufacture_date: string | null
          product_id: string
          quality_notes: string | null
          quantity: number
          remaining_qty: number
          source_invoice_id: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          batch_number: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          manufacture_date?: string | null
          product_id: string
          quality_notes?: string | null
          quantity?: number
          remaining_qty?: number
          source_invoice_id?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          manufacture_date?: string | null
          product_id?: string
          quality_notes?: string | null
          quantity?: number
          remaining_qty?: number
          source_invoice_id?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_source_invoice_id_fkey"
            columns: ["source_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          name_ur: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_ur?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_ur?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          account_category: string | null
          address: string | null
          city: string | null
          contact_type: Database["public"]["Enums"]["contact_type"]
          created_at: string
          credit_limit: number | null
          id: string
          name: string
          notes: string | null
          opening_balance: number | null
          payment_terms: Database["public"]["Enums"]["payment_terms"] | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_category?: string | null
          address?: string | null
          city?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          credit_limit?: number | null
          id?: string
          name: string
          notes?: string | null
          opening_balance?: number | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"] | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_category?: string | null
          address?: string | null
          city?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string
          credit_limit?: number | null
          id?: string
          name?: string
          notes?: string | null
          opening_balance?: number | null
          payment_terms?: Database["public"]["Enums"]["payment_terms"] | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          name_ur: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_ur?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_ur?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account_category: string | null
          amount: number
          business_unit: string | null
          category_id: string | null
          created_at: string
          expense_date: string
          id: string
          notes: string | null
          payment_method: string
        }
        Insert: {
          account_category?: string | null
          amount?: number
          business_unit?: string | null
          category_id?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string
        }
        Update: {
          account_category?: string | null
          amount?: number
          business_unit?: string | null
          category_id?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_number: string
          adjustment_type: string
          batch_id: string | null
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity_kg: number
          reason: string
        }
        Insert: {
          adjustment_date?: string
          adjustment_number: string
          adjustment_type: string
          batch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity_kg: number
          reason: string
        }
        Update: {
          adjustment_date?: string
          adjustment_number?: string
          adjustment_type?: string
          batch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity_kg?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          price_per_unit: number
          product_id: string
          quantity: number
          total: number
          unit_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          price_per_unit: number
          product_id: string
          quantity: number
          total: number
          unit_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          price_per_unit?: number
          product_id?: string
          quantity?: number
          total?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          balance_due: number
          broker_commission_rate: number | null
          broker_commission_total: number | null
          broker_commission_unit_id: string | null
          broker_contact_id: string | null
          business_unit: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          discount: number
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          subtotal: number
          total: number
          transport_charges: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          balance_due?: number
          broker_commission_rate?: number | null
          broker_commission_total?: number | null
          broker_commission_unit_id?: string | null
          broker_contact_id?: string | null
          business_unit?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          subtotal?: number
          total?: number
          transport_charges?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          balance_due?: number
          broker_commission_rate?: number | null
          broker_commission_total?: number | null
          broker_commission_unit_id?: string | null
          broker_contact_id?: string | null
          business_unit?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          subtotal?: number
          total?: number
          transport_charges?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_broker_commission_unit_id_fkey"
            columns: ["broker_commission_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_broker_contact_id_fkey"
            columns: ["broker_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_price: number
          old_price: number
          product_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price: number
          old_price: number
          product_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price?: number
          old_price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_outputs: {
        Row: {
          created_at: string
          id: string
          product_id: string
          production_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          production_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          production_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_outputs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_outputs_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
        ]
      }
      productions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          production_date: string
          source_product_id: string
          source_quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          production_date?: string
          source_product_id: string
          source_quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          production_date?: string
          source_product_id?: string
          source_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "productions_source_product_id_fkey"
            columns: ["source_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          conversion_ratio: number | null
          created_at: string
          default_price: number
          id: string
          is_tradeable: boolean
          min_stock_level: number
          name: string
          name_ur: string | null
          parent_product_id: string | null
          stock_qty: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          conversion_ratio?: number | null
          created_at?: string
          default_price?: number
          id?: string
          is_tradeable?: boolean
          min_stock_level?: number
          name: string
          name_ur?: string | null
          parent_product_id?: string | null
          stock_qty?: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          conversion_ratio?: number | null
          created_at?: string
          default_price?: number
          id?: string
          is_tradeable?: boolean
          min_stock_level?: number
          name?: string
          name_ur?: string | null
          parent_product_id?: string | null
          stock_qty?: number
          unit_id?: string | null
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
            foreignKeyName: "products_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          id: string
          kg_value: number
          name: string
          name_ur: string | null
          sub_unit_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kg_value?: number
          name: string
          name_ur?: string | null
          sub_unit_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kg_value?: number
          name?: string
          name_ur?: string | null
          sub_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_sub_unit_id_fkey"
            columns: ["sub_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "staff"
      contact_type: "customer" | "supplier" | "both" | "broker"
      invoice_type: "sale" | "purchase"
      payment_status: "paid" | "partial" | "credit" | "pending"
      payment_terms: "7" | "15" | "30"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["owner", "staff"],
      contact_type: ["customer", "supplier", "both", "broker"],
      invoice_type: ["sale", "purchase"],
      payment_status: ["paid", "partial", "credit", "pending"],
      payment_terms: ["7", "15", "30"],
    },
  },
} as const
