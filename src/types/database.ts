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
      account_notices: {
        Row: {
          calendar_name: string
          created_at: string
          id: string
          kind: string
          person_name: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          calendar_name: string
          created_at?: string
          id?: string
          kind: string
          person_name?: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          calendar_name?: string
          created_at?: string
          id?: string
          kind?: string
          person_name?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_notices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_email_requests: {
        Row: {
          created_at: string
          email_hash: string
        }
        Insert: {
          created_at?: string
          email_hash: string
        }
        Update: {
          created_at?: string
          email_hash?: string
        }
        Relationships: []
      }
      calendar_access_codes: {
        Row: {
          calendar_id: string
          created_at: string
          enabled: boolean
          pin_hash: string
          public_code: string
          role: Database["public"]["Enums"]["calendar_role"]
          updated_at: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          enabled?: boolean
          pin_hash: string
          public_code: string
          role: Database["public"]["Enums"]["calendar_role"]
          updated_at?: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          enabled?: boolean
          pin_hash?: string
          public_code?: string
          role?: Database["public"]["Enums"]["calendar_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_access_codes_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: true
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_invites: {
        Row: {
          calendar_id: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_uses: number
          revoked_at: string | null
          role: Database["public"]["Enums"]["calendar_role"]
          token_hash: string
          use_count: number
        }
        Insert: {
          calendar_id: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          max_uses: number
          revoked_at?: string | null
          role: Database["public"]["Enums"]["calendar_role"]
          token_hash: string
          use_count?: number
        }
        Update: {
          calendar_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_uses?: number
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["calendar_role"]
          token_hash?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_invites_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_members: {
        Row: {
          calendar_id: string
          created_at: string
          role: Database["public"]["Enums"]["calendar_role"]
          user_id: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          role: Database["public"]["Enums"]["calendar_role"]
          user_id: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["calendar_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_members_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_orphan_decisions: {
        Row: {
          calendar_id: string
          decided_at: string
          keep: boolean
          user_id: string
        }
        Insert: {
          calendar_id: string
          decided_at?: string
          keep: boolean
          user_id: string
        }
        Update: {
          calendar_id?: string
          decided_at?: string
          keep?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_orphan_decisions_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_orphan_decisions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_preferences: {
        Row: {
          calendar_id: string
          created_at: string
          position: number | null
          updated_at: string
          user_id: string
          visible: boolean
        }
        Insert: {
          calendar_id: string
          created_at?: string
          position?: number | null
          updated_at?: string
          user_id: string
          visible?: boolean
        }
        Update: {
          calendar_id?: string
          created_at?: string
          position?: number | null
          updated_at?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calendar_preferences_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          orphaned_at: string | null
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          orphaned_at?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          orphaned_at?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendars_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          body: string
          created_at: string
          id: number
          sent_at: string | null
          subject: string
          to_email: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          id?: never
          sent_at?: string | null
          subject: string
          to_email: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          id?: never
          sent_at?: string | null
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      event_categories: {
        Row: {
          calendar_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_categories_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          calendar_id: string
          category_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          calendar_id: string
          category_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          location?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          calendar_id?: string
          category_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_category_fkey"
            columns: ["category_id", "calendar_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id", "calendar_id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      join_attempts: {
        Row: {
          code: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      person_preferences: {
        Row: {
          created_at: string
          person_id: string
          position: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          person_id: string
          position?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          person_id?: string
          position?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_preferences_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent: string
          created_at: string
          display_name: string
          id: string
          time_zone: string
          updated_at: string
        }
        Insert: {
          accent?: string
          created_at?: string
          display_name: string
          id: string
          time_zone?: string
          updated_at?: string
        }
        Update: {
          accent?: string
          created_at?: string
          display_name?: string
          id?: string
          time_zone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string }
      calendar_members_with_names: {
        Args: { p_calendar_ids: string[] }
        Returns: {
          calendar_id: string
          display_name: string
          role: Database["public"]["Enums"]["calendar_role"]
          user_id: string
        }[]
      }
      calendar_role_for: {
        Args: { p_calendar_id: string }
        Returns: Database["public"]["Enums"]["calendar_role"]
      }
      create_invite: {
        Args: {
          p_calendar_id: string
          p_max_uses: number
          p_role: Database["public"]["Enums"]["calendar_role"]
        }
        Returns: string
      }
      disable_access_code: {
        Args: { p_calendar_id: string }
        Returns: undefined
      }
      generate_access_code_id: { Args: never; Returns: string }
      get_invite_preview: {
        Args: { p_token: string }
        Returns: {
          already_member: boolean
          calendar_name: string
          owner_name: string
          role: Database["public"]["Enums"]["calendar_role"]
        }[]
      }
      import_calendar: {
        Args: { p_color: string; p_events: Json; p_name: string }
        Returns: string
      }
      is_calendar_member: { Args: { p_calendar_id: string }; Returns: boolean }
      join_with_code: {
        Args: { p_code: string; p_pin: string }
        Returns: {
          calendar_id: string
          status: string
        }[]
      }
      list_tables_without_rls: { Args: never; Returns: string[] }
      merge_calendars: {
        Args: {
          p_color?: string
          p_name?: string
          p_source_ids: string[]
          p_target_id?: string
        }
        Returns: string
      }
      request_recovery: { Args: { p_email: string }; Returns: boolean }
      revoke_invite: { Args: { p_invite_id: string }; Returns: undefined }
      set_access_code: {
        Args: {
          p_calendar_id: string
          p_pin: string
          p_role: Database["public"]["Enums"]["calendar_role"]
        }
        Returns: string
      }
      visible_people: {
        Args: never
        Returns: {
          display_name: string
          id: string
        }[]
      }
    }
    Enums: {
      calendar_role: "owner" | "editor" | "viewer"
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
      calendar_role: ["owner", "editor", "viewer"],
    },
  },
} as const
