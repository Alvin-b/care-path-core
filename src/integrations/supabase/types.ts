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
      app_versions: {
        Row: {
          build_number: number
          download_url: string
          id: string
          mandatory: boolean
          platform: Database["public"]["Enums"]["platform_kind"]
          published_at: string
          release_notes: string | null
          sha256: string
          size_bytes: number | null
          version: string
        }
        Insert: {
          build_number: number
          download_url: string
          id?: string
          mandatory?: boolean
          platform: Database["public"]["Enums"]["platform_kind"]
          published_at?: string
          release_notes?: string | null
          sha256: string
          size_bytes?: number | null
          version: string
        }
        Update: {
          build_number?: number
          download_url?: string
          id?: string
          mandatory?: boolean
          platform?: Database["public"]["Enums"]["platform_kind"]
          published_at?: string
          release_notes?: string | null
          sha256?: string
          size_bytes?: number | null
          version?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          branch_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          hospital_id: string | null
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          hospital_id?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          branch_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          hospital_id?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          active: boolean
          address: string | null
          code: string
          created_at: string
          gps_lat: number | null
          gps_lng: number | null
          hospital_id: string
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          code: string
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          hospital_id: string
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          code?: string
          created_at?: string
          gps_lat?: number | null
          gps_lng?: number | null
          hospital_id?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean
          branch_id: string | null
          code: string
          created_at: string
          hospital_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          code: string
          created_at?: string
          hospital_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          code?: string
          created_at?: string
          hospital_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_branding: {
        Row: {
          accent_color: string | null
          app_name: string | null
          hospital_id: string
          logo_url: string | null
          prescription_header: string | null
          primary_color: string | null
          receipt_footer: string | null
          receipt_header: string | null
          report_header: string | null
          secondary_color: string | null
          splash_url: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          app_name?: string | null
          hospital_id: string
          logo_url?: string | null
          prescription_header?: string | null
          primary_color?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          report_header?: string | null
          secondary_color?: string | null
          splash_url?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          app_name?: string | null
          hospital_id?: string
          logo_url?: string | null
          prescription_header?: string | null
          primary_color?: string | null
          receipt_footer?: string | null
          receipt_header?: string | null
          report_header?: string | null
          secondary_color?: string | null
          splash_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_branding_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: true
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          branch_id: string | null
          created_at: string
          department_id: string | null
          email: string
          expires_at: string
          hospital_id: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          branch_id?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          expires_at?: string
          hospital_id: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          branch_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          expires_at?: string
          hospital_id?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_invites_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_invites_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_invites_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_modules: {
        Row: {
          enabled: boolean
          hospital_id: string
          id: string
          installed_at: string
          licensed_until: string | null
          module_id: string
          settings: Json
        }
        Insert: {
          enabled?: boolean
          hospital_id: string
          id?: string
          installed_at?: string
          licensed_until?: string | null
          module_id: string
          settings?: Json
        }
        Update: {
          enabled?: boolean
          hospital_id?: string
          id?: string
          installed_at?: string
          licensed_until?: string | null
          module_id?: string
          settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hospital_modules_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_settings: {
        Row: {
          category: string
          hospital_id: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          category: string
          hospital_id: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          category?: string
          hospital_id?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hospital_settings_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          address: string | null
          code: string
          country: string
          created_at: string
          currency: string
          dha_reg_no: string | null
          email: string | null
          facility_level: Database["public"]["Enums"]["facility_level"]
          id: string
          name: string
          phone: string | null
          sha_reg_no: string | null
          status: string
          tax_pin: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          country?: string
          created_at?: string
          currency?: string
          dha_reg_no?: string | null
          email?: string | null
          facility_level?: Database["public"]["Enums"]["facility_level"]
          id?: string
          name: string
          phone?: string | null
          sha_reg_no?: string | null
          status?: string
          tax_pin?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          country?: string
          created_at?: string
          currency?: string
          dha_reg_no?: string | null
          email?: string | null
          facility_level?: Database["public"]["Enums"]["facility_level"]
          id?: string
          name?: string
          phone?: string | null
          sha_reg_no?: string | null
          status?: string
          tax_pin?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      licenses: {
        Row: {
          created_at: string
          expires_at: string | null
          hospital_id: string
          id: string
          max_branches: number | null
          max_users: number | null
          notes: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          starts_at: string
          status: Database["public"]["Enums"]["license_status"]
          support_plan: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          hospital_id: string
          id?: string
          max_branches?: number | null
          max_users?: number | null
          notes?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          starts_at?: string
          status?: Database["public"]["Enums"]["license_status"]
          support_plan?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          hospital_id?: string
          id?: string
          max_branches?: number | null
          max_users?: number | null
          notes?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          starts_at?: string
          status?: Database["public"]["Enums"]["license_status"]
          support_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "licenses_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      module_dependencies: {
        Row: {
          depends_on_module_id: string
          module_id: string
        }
        Insert: {
          depends_on_module_id: string
          module_id: string
        }
        Update: {
          depends_on_module_id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_dependencies_depends_on_module_id_fkey"
            columns: ["depends_on_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_dependencies_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_core: boolean
          min_plan: Database["public"]["Enums"]["subscription_plan"]
          name: string
          sort_order: number
          status: Database["public"]["Enums"]["module_status"]
          version: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_core?: boolean
          min_plan?: Database["public"]["Enums"]["subscription_plan"]
          name: string
          sort_order?: number
          status?: Database["public"]["Enums"]["module_status"]
          version?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_core?: boolean
          min_plan?: Database["public"]["Enums"]["subscription_plan"]
          name?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["module_status"]
          version?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          data: Json
          hospital_id: string | null
          id: string
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          data?: Json
          hospital_id?: string | null
          id?: string
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          data?: Json
          hospital_id?: string | null
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          description: string | null
          id: string
          module_code: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          module_code: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          module_code?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          branch_id: string | null
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string | null
          hospital_id: string | null
          id: string
          last_login_at: string | null
          phone: string | null
          staff_number: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          hospital_id?: string | null
          id: string
          last_login_at?: string | null
          phone?: string | null
          staff_number?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          hospital_id?: string | null
          id?: string
          last_login_at?: string | null
          phone?: string | null
          staff_number?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          hospital_id: string | null
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          hospital_id?: string | null
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          hospital_id?: string | null
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          hospital_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          hospital_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          hospital_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_hospital_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _hospital_id?: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_hospital_admin: { Args: { _hospital_id: string }; Returns: boolean }
      is_hospital_member: { Args: { _hospital_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      public_hospital_config: { Args: { _code: string }; Returns: Json }
      recommend_modules_for_level: {
        Args: { _level: Database["public"]["Enums"]["facility_level"] }
        Returns: string[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "hospital_admin"
        | "doctor"
        | "nurse"
        | "receptionist"
        | "pharmacist"
        | "lab_tech"
        | "radiographer"
        | "accountant"
        | "storekeeper"
        | "hr"
        | "cashier"
        | "triage_nurse"
        | "manager"
      facility_level:
        | "dispensary"
        | "clinic"
        | "health_centre"
        | "sub_county_hospital"
        | "county_hospital"
        | "referral_hospital"
        | "private_hospital"
        | "diagnostic_centre"
      license_status: "trial" | "active" | "expired" | "suspended" | "cancelled"
      module_status: "available" | "installed" | "disabled" | "deprecated"
      platform_kind: "android" | "ios" | "windows" | "macos" | "linux" | "web"
      subscription_plan:
        | "starter"
        | "professional"
        | "enterprise"
        | "government"
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
      app_role: [
        "super_admin",
        "hospital_admin",
        "doctor",
        "nurse",
        "receptionist",
        "pharmacist",
        "lab_tech",
        "radiographer",
        "accountant",
        "storekeeper",
        "hr",
        "cashier",
        "triage_nurse",
        "manager",
      ],
      facility_level: [
        "dispensary",
        "clinic",
        "health_centre",
        "sub_county_hospital",
        "county_hospital",
        "referral_hospital",
        "private_hospital",
        "diagnostic_centre",
      ],
      license_status: ["trial", "active", "expired", "suspended", "cancelled"],
      module_status: ["available", "installed", "disabled", "deprecated"],
      platform_kind: ["android", "ios", "windows", "macos", "linux", "web"],
      subscription_plan: [
        "starter",
        "professional",
        "enterprise",
        "government",
      ],
    },
  },
} as const
