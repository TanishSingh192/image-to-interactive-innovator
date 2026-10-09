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
      experiments: {
        Row: {
          action_budget: number
          agents: string[]
          completed_at: string | null
          created_at: string
          environments: string[]
          hypothesis: string
          id: string
          name: string
          prompt_version: string
          repetitions: number
          seed: number
          started_at: string | null
          status: string
          temperature: number
          timeout_s: number
          user_id: string
        }
        Insert: {
          action_budget?: number
          agents?: string[]
          completed_at?: string | null
          created_at?: string
          environments?: string[]
          hypothesis?: string
          id?: string
          name: string
          prompt_version?: string
          repetitions?: number
          seed?: number
          started_at?: string | null
          status?: string
          temperature?: number
          timeout_s?: number
          user_id?: string
        }
        Update: {
          action_budget?: number
          agents?: string[]
          completed_at?: string | null
          created_at?: string
          environments?: string[]
          hypothesis?: string
          id?: string
          name?: string
          prompt_version?: string
          repetitions?: number
          seed?: number
          started_at?: string | null
          status?: string
          temperature?: number
          timeout_s?: number
          user_id?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          actions: number
          agent: string
          cost: number
          created_at: string
          duration_ms: number
          environment: string
          experiment_id: string
          failures: number
          id: string
          repetition: number
          retries: number
          score: number
          solved: boolean
          status: string
          tokens: number
          user_id: string
        }
        Insert: {
          actions?: number
          agent: string
          cost?: number
          created_at?: string
          duration_ms?: number
          environment: string
          experiment_id: string
          failures?: number
          id?: string
          repetition?: number
          retries?: number
          score?: number
          solved?: boolean
          status?: string
          tokens?: number
          user_id?: string
        }
        Update: {
          actions?: number
          agent?: string
          cost?: number
          created_at?: string
          duration_ms?: number
          environment?: string
          experiment_id?: string
          failures?: number
          id?: string
          repetition?: number
          retries?: number
          score?: number
          solved?: boolean
          status?: string
          tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
        ]
      }
      steps: {
        Row: {
          error: string | null
          executed_action: string
          id: string
          latency_ms: number
          observation: Json
          proposed_action: string
          run_id: string
          state_change: string
          step_index: number
          tokens: number
          user_id: string
          valid: boolean
        }
        Insert: {
          error?: string | null
          executed_action: string
          id?: string
          latency_ms?: number
          observation: Json
          proposed_action: string
          run_id: string
          state_change?: string
          step_index: number
          tokens?: number
          user_id?: string
          valid?: boolean
        }
        Update: {
          error?: string | null
          executed_action?: string
          id?: string
          latency_ms?: number
          observation?: Json
          proposed_action?: string
          run_id?: string
          state_change?: string
          step_index?: number
          tokens?: number
          user_id?: string
          valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
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
