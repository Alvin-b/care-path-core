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
      inventory_batches: {
        Row: {
          batch_no: string | null
          branch_id: string | null
          cost_price: number
          created_at: string
          expiry_date: string | null
          hospital_id: string
          id: string
          item_id: string
          notes: string | null
          quantity_on_hand: number
          received_at: string
          received_by: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          batch_no?: string | null
          branch_id?: string | null
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          hospital_id: string
          id?: string
          item_id: string
          notes?: string | null
          quantity_on_hand?: number
          received_at?: string
          received_by?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          batch_no?: string | null
          branch_id?: string | null
          cost_price?: number
          created_at?: string
          expiry_date?: string | null
          hospital_id?: string
          id?: string
          item_id?: string
          notes?: string | null
          quantity_on_hand?: number
          received_at?: string
          received_by?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["item_category"]
          created_at: string
          created_by: string | null
          description: string | null
          form: string | null
          generic_name: string | null
          hospital_id: string
          id: string
          is_controlled: boolean
          manufacturer: string | null
          name: string
          reorder_level: number
          sku: string | null
          strength: string | null
          tags: string[]
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          form?: string | null
          generic_name?: string | null
          hospital_id: string
          id?: string
          is_controlled?: boolean
          manufacturer?: string | null
          name: string
          reorder_level?: number
          sku?: string | null
          strength?: string | null
          tags?: string[]
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["item_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          form?: string | null
          generic_name?: string | null
          hospital_id?: string
          id?: string
          is_controlled?: boolean
          manufacturer?: string | null
          name?: string
          reorder_level?: number
          sku?: string | null
          strength?: string | null
          tags?: string[]
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
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
      patient_counters: {
        Row: {
          hospital_id: string
          last_value: number
        }
        Insert: {
          hospital_id: string
          last_value?: number
        }
        Update: {
          hospital_id?: string
          last_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_counters_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: true
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_embeddings: {
        Row: {
          embedding: string
          hospital_id: string
          model_version: string
          patient_id: string
          source_text: string
          updated_at: string
        }
        Insert: {
          embedding: string
          hospital_id: string
          model_version?: string
          patient_id: string
          source_text: string
          updated_at?: string
        }
        Update: {
          embedding?: string
          hospital_id?: string
          model_version?: string
          patient_id?: string
          source_text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_embeddings_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_embeddings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address_line: string | null
          allergies: string[]
          alt_phone: string | null
          birth_cert_no: string | null
          blood_group: Database["public"]["Enums"]["blood_group"]
          branch_id: string | null
          chronic_conditions: string[]
          consent_data_processing: boolean
          consent_signed_at: string | null
          consent_sms: boolean
          county: string | null
          created_at: string
          date_of_birth: string | null
          deceased_at: string | null
          disabilities: string[]
          dob_estimated: boolean
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          employer: string | null
          first_name: string
          gender_identity: string | null
          hospital_id: string
          id: string
          is_confidential: boolean
          is_deceased: boolean
          is_vip: boolean
          last_name: string
          marital_status: Database["public"]["Enums"]["marital_status"]
          merged_into: string | null
          middle_name: string | null
          mrn: string
          national_id: string | null
          nationality: string | null
          nhif_number: string | null
          nok_address: string | null
          nok_alt_phone: string | null
          nok_name: string | null
          nok_phone: string | null
          nok_relationship: string | null
          notes: string | null
          occupation: string | null
          other_insurance: Json
          other_names: string | null
          passport_no: string | null
          phone: string | null
          photo_url: string | null
          postal_code: string | null
          preferred_language: string | null
          preferred_name: string | null
          registered_by: string | null
          religion: string | null
          sex: Database["public"]["Enums"]["patient_sex"]
          sha_cr_id: string | null
          sha_number: string | null
          sub_county: string | null
          updated_at: string
          village: string | null
          ward: string | null
        }
        Insert: {
          address_line?: string | null
          allergies?: string[]
          alt_phone?: string | null
          birth_cert_no?: string | null
          blood_group?: Database["public"]["Enums"]["blood_group"]
          branch_id?: string | null
          chronic_conditions?: string[]
          consent_data_processing?: boolean
          consent_signed_at?: string | null
          consent_sms?: boolean
          county?: string | null
          created_at?: string
          date_of_birth?: string | null
          deceased_at?: string | null
          disabilities?: string[]
          dob_estimated?: boolean
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employer?: string | null
          first_name: string
          gender_identity?: string | null
          hospital_id: string
          id?: string
          is_confidential?: boolean
          is_deceased?: boolean
          is_vip?: boolean
          last_name: string
          marital_status?: Database["public"]["Enums"]["marital_status"]
          merged_into?: string | null
          middle_name?: string | null
          mrn: string
          national_id?: string | null
          nationality?: string | null
          nhif_number?: string | null
          nok_address?: string | null
          nok_alt_phone?: string | null
          nok_name?: string | null
          nok_phone?: string | null
          nok_relationship?: string | null
          notes?: string | null
          occupation?: string | null
          other_insurance?: Json
          other_names?: string | null
          passport_no?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          preferred_name?: string | null
          registered_by?: string | null
          religion?: string | null
          sex?: Database["public"]["Enums"]["patient_sex"]
          sha_cr_id?: string | null
          sha_number?: string | null
          sub_county?: string | null
          updated_at?: string
          village?: string | null
          ward?: string | null
        }
        Update: {
          address_line?: string | null
          allergies?: string[]
          alt_phone?: string | null
          birth_cert_no?: string | null
          blood_group?: Database["public"]["Enums"]["blood_group"]
          branch_id?: string | null
          chronic_conditions?: string[]
          consent_data_processing?: boolean
          consent_signed_at?: string | null
          consent_sms?: boolean
          county?: string | null
          created_at?: string
          date_of_birth?: string | null
          deceased_at?: string | null
          disabilities?: string[]
          dob_estimated?: boolean
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employer?: string | null
          first_name?: string
          gender_identity?: string | null
          hospital_id?: string
          id?: string
          is_confidential?: boolean
          is_deceased?: boolean
          is_vip?: boolean
          last_name?: string
          marital_status?: Database["public"]["Enums"]["marital_status"]
          merged_into?: string | null
          middle_name?: string | null
          mrn?: string
          national_id?: string | null
          nationality?: string | null
          nhif_number?: string | null
          nok_address?: string | null
          nok_alt_phone?: string | null
          nok_name?: string | null
          nok_phone?: string | null
          nok_relationship?: string | null
          notes?: string | null
          occupation?: string | null
          other_insurance?: Json
          other_names?: string | null
          passport_no?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          preferred_language?: string | null
          preferred_name?: string | null
          registered_by?: string | null
          religion?: string | null
          sex?: Database["public"]["Enums"]["patient_sex"]
          sha_cr_id?: string | null
          sha_number?: string | null
          sub_county?: string | null
          updated_at?: string
          village?: string | null
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "patients"
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
      prescription_items: {
        Row: {
          created_at: string
          dosage: string | null
          duration_days: number | null
          frequency: string | null
          id: string
          instructions: string | null
          item_id: string
          prescription_id: string
          quantity_dispensed: number
          quantity_ordered: number
          route: string | null
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          duration_days?: number | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          item_id: string
          prescription_id: string
          quantity_dispensed?: number
          quantity_ordered: number
          route?: string | null
        }
        Update: {
          created_at?: string
          dosage?: string | null
          duration_days?: number | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          item_id?: string
          prescription_id?: string
          quantity_dispensed?: number
          quantity_ordered?: number
          route?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          dispensed_at: string | null
          dispensed_by: string | null
          hospital_id: string
          id: string
          notes: string | null
          patient_id: string
          prescribed_by: string | null
          status: Database["public"]["Enums"]["prescription_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispensed_at?: string | null
          dispensed_by?: string | null
          hospital_id: string
          id?: string
          notes?: string | null
          patient_id: string
          prescribed_by?: string | null
          status?: Database["public"]["Enums"]["prescription_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispensed_at?: string | null
          dispensed_by?: string | null
          hospital_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          prescribed_by?: string | null
          status?: Database["public"]["Enums"]["prescription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
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
      referral_rules: {
        Row: {
          from_role: Database["public"]["Enums"]["app_role"]
          id: string
          to_dept_code: string
        }
        Insert: {
          from_role: Database["public"]["Enums"]["app_role"]
          id?: string
          to_dept_code: string
        }
        Update: {
          from_role?: Database["public"]["Enums"]["app_role"]
          id?: string
          to_dept_code?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          called_at: string | null
          clinical_notes: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          from_department_id: string | null
          from_user_id: string | null
          hospital_id: string
          id: string
          patient_id: string
          priority: Database["public"]["Enums"]["referral_priority"]
          queue_date: string
          queue_number: number | null
          reason: string
          started_at: string | null
          status: Database["public"]["Enums"]["referral_status"]
          to_department_id: string
          to_user_id: string | null
          updated_at: string
        }
        Insert: {
          called_at?: string | null
          clinical_notes?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          from_department_id?: string | null
          from_user_id?: string | null
          hospital_id: string
          id?: string
          patient_id: string
          priority?: Database["public"]["Enums"]["referral_priority"]
          queue_date?: string
          queue_number?: number | null
          reason: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          to_department_id: string
          to_user_id?: string | null
          updated_at?: string
        }
        Update: {
          called_at?: string | null
          clinical_notes?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          from_department_id?: string | null
          from_user_id?: string | null
          hospital_id?: string
          id?: string
          patient_id?: string
          priority?: Database["public"]["Enums"]["referral_priority"]
          queue_date?: string
          queue_number?: number | null
          reason?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          to_department_id?: string
          to_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_from_department_id_fkey"
            columns: ["from_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_to_department_id_fkey"
            columns: ["to_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
      sha_claim_events: {
        Row: {
          actor: string | null
          claim_id: string
          created_at: string
          event_type: string
          from_state: Database["public"]["Enums"]["sha_claim_state"] | null
          hospital_id: string
          http_status: number | null
          id: string
          message: string | null
          payload: Json | null
          to_state: Database["public"]["Enums"]["sha_claim_state"] | null
        }
        Insert: {
          actor?: string | null
          claim_id: string
          created_at?: string
          event_type: string
          from_state?: Database["public"]["Enums"]["sha_claim_state"] | null
          hospital_id: string
          http_status?: number | null
          id?: string
          message?: string | null
          payload?: Json | null
          to_state?: Database["public"]["Enums"]["sha_claim_state"] | null
        }
        Update: {
          actor?: string | null
          claim_id?: string
          created_at?: string
          event_type?: string
          from_state?: Database["public"]["Enums"]["sha_claim_state"] | null
          hospital_id?: string
          http_status?: number | null
          id?: string
          message?: string | null
          payload?: Json | null
          to_state?: Database["public"]["Enums"]["sha_claim_state"] | null
        }
        Relationships: [
          {
            foreignKeyName: "sha_claim_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "sha_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sha_claim_events_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      sha_claims: {
        Row: {
          billable_end: string | null
          billable_start: string | null
          bundle_id: string
          claim_ref: string
          claim_type: string
          cr_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          diagnoses: Json
          error_message: string | null
          hospital_id: string
          http_status: number | null
          id: string
          items: Json
          last_state_at: string
          paid_amount: number | null
          paid_at: string | null
          patient_id: string
          practitioner_name: string | null
          practitioner_puid: string | null
          preauth_token: string | null
          provider_auth_token: string | null
          request_bundle: Json | null
          response_payload: Json | null
          sha_number: string | null
          state: Database["public"]["Enums"]["sha_claim_state"]
          submitted_at: string | null
          submitted_by: string | null
          subtype: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          billable_end?: string | null
          billable_start?: string | null
          bundle_id?: string
          claim_ref?: string
          claim_type?: string
          cr_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          diagnoses?: Json
          error_message?: string | null
          hospital_id: string
          http_status?: number | null
          id?: string
          items?: Json
          last_state_at?: string
          paid_amount?: number | null
          paid_at?: string | null
          patient_id: string
          practitioner_name?: string | null
          practitioner_puid?: string | null
          preauth_token?: string | null
          provider_auth_token?: string | null
          request_bundle?: Json | null
          response_payload?: Json | null
          sha_number?: string | null
          state?: Database["public"]["Enums"]["sha_claim_state"]
          submitted_at?: string | null
          submitted_by?: string | null
          subtype?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          billable_end?: string | null
          billable_start?: string | null
          bundle_id?: string
          claim_ref?: string
          claim_type?: string
          cr_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          diagnoses?: Json
          error_message?: string | null
          hospital_id?: string
          http_status?: number | null
          id?: string
          items?: Json
          last_state_at?: string
          paid_amount?: number | null
          paid_at?: string | null
          patient_id?: string
          practitioner_name?: string | null
          practitioner_puid?: string | null
          preauth_token?: string | null
          provider_auth_token?: string | null
          request_bundle?: Json | null
          response_payload?: Json | null
          sha_number?: string | null
          state?: Database["public"]["Enums"]["sha_claim_state"]
          submitted_at?: string | null
          submitted_by?: string | null
          subtype?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sha_claims_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sha_claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      sha_dispatch_queue: {
        Row: {
          attempts: number
          claim_id: string | null
          created_at: string
          hospital_id: string
          id: string
          last_error: string | null
          next_attempt_at: string
          operation: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          claim_id?: string | null
          created_at?: string
          hospital_id: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          operation: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          claim_id?: string | null
          created_at?: string
          hospital_id?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          operation?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sha_dispatch_queue_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "sha_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sha_dispatch_queue_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      sha_eligibility_checks: {
        Row: {
          check_kind: string
          checked_at: string
          checked_by: string | null
          coverage_end_date: string | null
          cr_id: string | null
          eligible: boolean | null
          error_message: string | null
          full_name: string | null
          hospital_id: string
          http_status: number | null
          id: string
          identification_number: string
          identification_type: string
          message: string | null
          patient_id: string | null
          possible_solution: string | null
          reason: string | null
          request_payload: Json | null
          response_payload: Json | null
          sha_number: string | null
        }
        Insert: {
          check_kind?: string
          checked_at?: string
          checked_by?: string | null
          coverage_end_date?: string | null
          cr_id?: string | null
          eligible?: boolean | null
          error_message?: string | null
          full_name?: string | null
          hospital_id: string
          http_status?: number | null
          id?: string
          identification_number: string
          identification_type: string
          message?: string | null
          patient_id?: string | null
          possible_solution?: string | null
          reason?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          sha_number?: string | null
        }
        Update: {
          check_kind?: string
          checked_at?: string
          checked_by?: string | null
          coverage_end_date?: string | null
          cr_id?: string | null
          eligible?: boolean | null
          error_message?: string | null
          full_name?: string | null
          hospital_id?: string
          http_status?: number | null
          id?: string
          identification_number?: string
          identification_type?: string
          message?: string | null
          patient_id?: string | null
          possible_solution?: string | null
          reason?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          sha_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sha_eligibility_checks_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sha_eligibility_checks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      sha_settings: {
        Row: {
          base_url: string
          callback_basic_pass: string | null
          callback_basic_user: string | null
          callback_secret: string | null
          client_id: string | null
          client_secret: string | null
          configured_at: string | null
          configured_by: string | null
          created_at: string
          enabled: boolean
          environment: string
          facility_code: string | null
          facility_level: string | null
          fhir_base_url: string
          hospital_id: string
          last_test_at: string | null
          last_test_message: string | null
          last_test_ok: boolean | null
          token_url: string | null
          updated_at: string
        }
        Insert: {
          base_url?: string
          callback_basic_pass?: string | null
          callback_basic_user?: string | null
          callback_secret?: string | null
          client_id?: string | null
          client_secret?: string | null
          configured_at?: string | null
          configured_by?: string | null
          created_at?: string
          enabled?: boolean
          environment?: string
          facility_code?: string | null
          facility_level?: string | null
          fhir_base_url?: string
          hospital_id: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          token_url?: string | null
          updated_at?: string
        }
        Update: {
          base_url?: string
          callback_basic_pass?: string | null
          callback_basic_user?: string | null
          callback_secret?: string | null
          client_id?: string | null
          client_secret?: string | null
          configured_at?: string | null
          configured_by?: string | null
          created_at?: string
          enabled?: boolean
          environment?: string
          facility_code?: string | null
          facility_level?: string | null
          fhir_base_url?: string
          hospital_id?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          token_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sha_settings_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: true
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      sha_token_cache: {
        Row: {
          access_token: string
          expires_at: string
          hospital_id: string
          token_type: string
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at: string
          hospital_id: string
          token_type?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          hospital_id?: string
          token_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sha_token_cache_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: true
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          created_at: string
          hospital_id: string
          id: string
          item_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          patient_id: string | null
          performed_by: string | null
          prescription_id: string | null
          quantity: number
          reason: string | null
          unit_cost: number | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          hospital_id: string
          id?: string
          item_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          patient_id?: string | null
          performed_by?: string | null
          prescription_id?: string | null
          quantity: number
          reason?: string | null
          unit_cost?: number | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          hospital_id?: string
          id?: string
          item_id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          patient_id?: string | null
          performed_by?: string | null
          prescription_id?: string | null
          quantity?: number
          reason?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_prescription_fk"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
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
      advance_referral: {
        Args: {
          _notes?: string
          _referral_id: string
          _to_status: Database["public"]["Enums"]["referral_status"]
        }
        Returns: {
          called_at: string | null
          clinical_notes: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          from_department_id: string | null
          from_user_id: string | null
          hospital_id: string
          id: string
          patient_id: string
          priority: Database["public"]["Enums"]["referral_priority"]
          queue_date: string
          queue_number: number | null
          reason: string
          started_at: string | null
          status: Database["public"]["Enums"]["referral_status"]
          to_department_id: string
          to_user_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "referrals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_refer: {
        Args: { _to_dept_id: string; _user_id: string }
        Returns: boolean
      }
      create_referral: {
        Args: {
          _clinical_notes: string
          _patient_id: string
          _priority: Database["public"]["Enums"]["referral_priority"]
          _reason: string
          _to_department_id: string
        }
        Returns: {
          called_at: string | null
          clinical_notes: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          from_department_id: string | null
          from_user_id: string | null
          hospital_id: string
          id: string
          patient_id: string
          priority: Database["public"]["Enums"]["referral_priority"]
          queue_date: string
          queue_number: number | null
          reason: string
          started_at: string | null
          status: Database["public"]["Enums"]["referral_status"]
          to_department_id: string
          to_user_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "referrals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_hospital_id: { Args: never; Returns: string }
      dispense_prescription: {
        Args: { _lines: Json; _prescription_id: string }
        Returns: Json
      }
      find_patient_duplicates: {
        Args: {
          _dob: string
          _first_name: string
          _hospital_id: string
          _last_name: string
          _national_id: string
          _phone: string
        }
        Returns: {
          address_line: string | null
          allergies: string[]
          alt_phone: string | null
          birth_cert_no: string | null
          blood_group: Database["public"]["Enums"]["blood_group"]
          branch_id: string | null
          chronic_conditions: string[]
          consent_data_processing: boolean
          consent_signed_at: string | null
          consent_sms: boolean
          county: string | null
          created_at: string
          date_of_birth: string | null
          deceased_at: string | null
          disabilities: string[]
          dob_estimated: boolean
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          employer: string | null
          first_name: string
          gender_identity: string | null
          hospital_id: string
          id: string
          is_confidential: boolean
          is_deceased: boolean
          is_vip: boolean
          last_name: string
          marital_status: Database["public"]["Enums"]["marital_status"]
          merged_into: string | null
          middle_name: string | null
          mrn: string
          national_id: string | null
          nationality: string | null
          nhif_number: string | null
          nok_address: string | null
          nok_alt_phone: string | null
          nok_name: string | null
          nok_phone: string | null
          nok_relationship: string | null
          notes: string | null
          occupation: string | null
          other_insurance: Json
          other_names: string | null
          passport_no: string | null
          phone: string | null
          photo_url: string | null
          postal_code: string | null
          preferred_language: string | null
          preferred_name: string | null
          registered_by: string | null
          religion: string | null
          sex: Database["public"]["Enums"]["patient_sex"]
          sha_cr_id: string | null
          sha_number: string | null
          sub_county: string | null
          updated_at: string
          village: string | null
          ward: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "patients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      match_patients_by_embedding: {
        Args: {
          _hospital_id: string
          _limit?: number
          _min_similarity?: number
          _query: string
        }
        Returns: {
          date_of_birth: string
          first_name: string
          last_name: string
          mrn: string
          patient_id: string
          phone: string
          similarity: number
        }[]
      }
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
      blood_group:
        | "A+"
        | "A-"
        | "B+"
        | "B-"
        | "AB+"
        | "AB-"
        | "O+"
        | "O-"
        | "unknown"
      facility_level:
        | "dispensary"
        | "clinic"
        | "health_centre"
        | "sub_county_hospital"
        | "county_hospital"
        | "referral_hospital"
        | "private_hospital"
        | "diagnostic_centre"
      item_category:
        | "medication"
        | "supply"
        | "consumable"
        | "equipment"
        | "reagent"
        | "other"
      license_status: "trial" | "active" | "expired" | "suspended" | "cancelled"
      marital_status:
        | "single"
        | "married"
        | "divorced"
        | "widowed"
        | "separated"
        | "cohabiting"
        | "unknown"
      module_status: "available" | "installed" | "disabled" | "deprecated"
      patient_sex: "male" | "female" | "intersex" | "unknown"
      platform_kind: "android" | "ios" | "windows" | "macos" | "linux" | "web"
      prescription_status: "pending" | "partial" | "dispensed" | "cancelled"
      referral_priority: "routine" | "urgent" | "emergency"
      referral_status:
        | "queued"
        | "called"
        | "in_progress"
        | "completed"
        | "cancelled"
      sha_claim_state:
        | "draft"
        | "validating"
        | "submitted"
        | "queued"
        | "in-review"
        | "clinical-review"
        | "approved"
        | "rejected"
        | "sent-for-payment-processing"
        | "sent-to-surveillance"
        | "payment-completed"
        | "payment-declined"
        | "error"
      stock_movement_type:
        | "receipt"
        | "dispense"
        | "adjustment"
        | "wastage"
        | "transfer_in"
        | "transfer_out"
        | "return"
        | "opening_balance"
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
      blood_group: [
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
        "unknown",
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
      item_category: [
        "medication",
        "supply",
        "consumable",
        "equipment",
        "reagent",
        "other",
      ],
      license_status: ["trial", "active", "expired", "suspended", "cancelled"],
      marital_status: [
        "single",
        "married",
        "divorced",
        "widowed",
        "separated",
        "cohabiting",
        "unknown",
      ],
      module_status: ["available", "installed", "disabled", "deprecated"],
      patient_sex: ["male", "female", "intersex", "unknown"],
      platform_kind: ["android", "ios", "windows", "macos", "linux", "web"],
      prescription_status: ["pending", "partial", "dispensed", "cancelled"],
      referral_priority: ["routine", "urgent", "emergency"],
      referral_status: [
        "queued",
        "called",
        "in_progress",
        "completed",
        "cancelled",
      ],
      sha_claim_state: [
        "draft",
        "validating",
        "submitted",
        "queued",
        "in-review",
        "clinical-review",
        "approved",
        "rejected",
        "sent-for-payment-processing",
        "sent-to-surveillance",
        "payment-completed",
        "payment-declined",
        "error",
      ],
      stock_movement_type: [
        "receipt",
        "dispense",
        "adjustment",
        "wastage",
        "transfer_in",
        "transfer_out",
        "return",
        "opening_balance",
      ],
      subscription_plan: [
        "starter",
        "professional",
        "enterprise",
        "government",
      ],
    },
  },
} as const
