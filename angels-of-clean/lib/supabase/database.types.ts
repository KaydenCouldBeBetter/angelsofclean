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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          booking_id: string
          created_at: string
          description: string
          id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          description: string
          id?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          description?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_employees: {
        Row: {
          assigned_at: string
          booking_id: string
          employee_id: string
        }
        Insert: {
          assigned_at?: string
          booking_id: string
          employee_id: string
        }
        Update: {
          assigned_at?: string
          booking_id?: string
          employee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_employees_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          address: string
          bathrooms: number
          bedrooms: number
          booking_number: number
          city: string
          client_name: string
          created_at: string
          email: string
          end_at: string
          frequency: string
          id: string
          notes: string | null
          phone: string
          scheduled_date: string
          service_type: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          submitted_at: string
          time_slot: string
          updated_at: string
          zip: string
        }
        Insert: {
          address: string
          bathrooms: number
          bedrooms: number
          booking_number?: never
          city: string
          client_name: string
          created_at?: string
          email: string
          end_at: string
          frequency: string
          id?: string
          notes?: string | null
          phone: string
          scheduled_date: string
          service_type: string
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          submitted_at?: string
          time_slot: string
          updated_at?: string
          zip: string
        }
        Update: {
          address?: string
          bathrooms?: number
          bedrooms?: number
          booking_number?: never
          city?: string
          client_name?: string
          created_at?: string
          email?: string
          end_at?: string
          frequency?: string
          id?: string
          notes?: string | null
          phone?: string
          scheduled_date?: string
          service_type?: string
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          submitted_at?: string
          time_slot?: string
          updated_at?: string
          zip?: string
        }
        Relationships: []
      }
      commercial_quotes: {
        Row: {
          address: string
          business_name: string
          city: string
          contact_name: string
          email: string
          facility_type: string
          floors: number
          frequency: string
          id: string
          notes: string | null
          phone: string
          quote_number: number
          schedule_preference: string | null
          service_areas: string[]
          sqft_range: string
          submitted_at: string
          updated_at: string
          zip: string
        }
        Insert: {
          address: string
          business_name: string
          city: string
          contact_name: string
          email: string
          facility_type: string
          floors: number
          frequency: string
          id?: string
          notes?: string | null
          phone: string
          quote_number?: never
          schedule_preference?: string | null
          service_areas: string[]
          sqft_range: string
          submitted_at?: string
          updated_at?: string
          zip: string
        }
        Update: {
          address?: string
          business_name?: string
          city?: string
          contact_name?: string
          email?: string
          facility_type?: string
          floors?: number
          frequency?: string
          id?: string
          notes?: string | null
          phone?: string
          quote_number?: never
          schedule_preference?: string | null
          service_areas?: string[]
          sqft_range?: string
          submitted_at?: string
          updated_at?: string
          zip?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          hired_date: string
          id: string
          initials: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          hired_date: string
          id?: string
          initials: string
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          hired_date?: string
          id?: string
          initials?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_booking_employees: {
        Args: {
          p_allow_overlap?: boolean
          p_booking_id: string
          p_employee_ids: string[]
          p_expected_employee_ids: string[]
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
    }
    Enums: {
      booking_status: "pending" | "confirmed" | "active" | "done" | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status: ["pending", "confirmed", "active", "done", "cancelled"],
    },
  },
} as const
