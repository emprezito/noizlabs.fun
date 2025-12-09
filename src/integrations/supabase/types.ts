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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_wallets: {
        Row: {
          created_at: string | null
          id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      audio_clips: {
        Row: {
          audio_url: string
          category: string | null
          created_at: string
          creator: string
          id: string
          likes: number | null
          plays: number | null
          shares: number | null
          title: string
          wallet_address: string | null
        }
        Insert: {
          audio_url: string
          category?: string | null
          created_at?: string
          creator: string
          id?: string
          likes?: number | null
          plays?: number | null
          shares?: number | null
          title: string
          wallet_address?: string | null
        }
        Update: {
          audio_url?: string
          category?: string | null
          created_at?: string
          creator?: string
          id?: string
          likes?: number | null
          plays?: number | null
          shares?: number | null
          title?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      quest_definitions: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          icon: string | null
          id: string
          is_active: boolean | null
          points_reward: number
          reset_period: string
          social_link: string | null
          target: number
          task_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          points_reward?: number
          reset_period?: string
          social_link?: string | null
          target?: number
          task_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          points_reward?: number
          reset_period?: string
          social_link?: string | null
          target?: number
          task_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tokens: {
        Row: {
          audio_clip_id: string | null
          audio_url: string | null
          created_at: string
          creator_wallet: string
          id: string
          initial_price: number
          metadata_uri: string | null
          mint_address: string
          name: string
          symbol: string
          total_supply: number
        }
        Insert: {
          audio_clip_id?: string | null
          audio_url?: string | null
          created_at?: string
          creator_wallet: string
          id?: string
          initial_price: number
          metadata_uri?: string | null
          mint_address: string
          name: string
          symbol: string
          total_supply: number
        }
        Update: {
          audio_clip_id?: string | null
          audio_url?: string | null
          created_at?: string
          creator_wallet?: string
          id?: string
          initial_price?: number
          metadata_uri?: string | null
          mint_address?: string
          name?: string
          symbol?: string
          total_supply?: number
        }
        Relationships: [
          {
            foreignKeyName: "tokens_audio_clip_id_fkey"
            columns: ["audio_clip_id"]
            isOneToOne: false
            referencedRelation: "audio_clips"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_history: {
        Row: {
          amount: number
          created_at: string
          id: string
          mint_address: string
          price_lamports: number
          signature: string | null
          token_id: string | null
          trade_type: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          mint_address: string
          price_lamports: number
          signature?: string | null
          token_id?: string | null
          trade_type: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mint_address?: string
          price_lamports?: number
          signature?: string | null
          token_id?: string | null
          trade_type?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_history_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_level: string
          earned_at: string
          id: string
          mint_address: string | null
          minted: boolean | null
          minted_at: string | null
          wallet_address: string
        }
        Insert: {
          badge_level: string
          earned_at?: string
          id?: string
          mint_address?: string | null
          minted?: boolean | null
          minted_at?: string | null
          wallet_address: string
        }
        Update: {
          badge_level?: string
          earned_at?: string
          id?: string
          mint_address?: string | null
          minted?: boolean | null
          minted_at?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      user_interactions: {
        Row: {
          audio_clip_id: string | null
          created_at: string
          id: string
          interaction_type: string
          wallet_address: string
        }
        Insert: {
          audio_clip_id?: string | null
          created_at?: string
          id?: string
          interaction_type: string
          wallet_address: string
        }
        Update: {
          audio_clip_id?: string | null
          created_at?: string
          id?: string
          interaction_type?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interactions_audio_clip_id_fkey"
            columns: ["audio_clip_id"]
            isOneToOne: false
            referencedRelation: "audio_clips"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          created_at: string
          id: string
          referral_code: string | null
          referral_earnings: number | null
          referred_by: string | null
          total_points: number | null
          updated_at: string
          username: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code?: string | null
          referral_earnings?: number | null
          referred_by?: string | null
          total_points?: number | null
          updated_at?: string
          username?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string | null
          referral_earnings?: number | null
          referred_by?: string | null
          total_points?: number | null
          updated_at?: string
          username?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      user_tasks: {
        Row: {
          completed: boolean | null
          created_at: string
          id: string
          last_reset: string
          points_reward: number
          progress: number | null
          reset_period: string
          target: number
          task_type: string
          wallet_address: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          id?: string
          last_reset?: string
          points_reward: number
          progress?: number | null
          reset_period: string
          target: number
          task_type: string
          wallet_address: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          id?: string
          last_reset?: string
          points_reward?: number
          progress?: number | null
          reset_period?: string
          target?: number
          task_type?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_referral_code: { Args: never; Returns: string }
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
    Enums: {},
  },
} as const
