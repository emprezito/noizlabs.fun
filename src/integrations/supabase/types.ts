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
      analytics_snapshots: {
        Row: {
          clips_uploaded: number | null
          connected_wallets: number | null
          created_at: string
          daily_active_wallets: number | null
          id: string
          minted_tokens: number | null
          remixed_tokens: number | null
          revenue_lamports: number | null
          snapshot_date: string
          snapshot_hour: number | null
          tokens_launched: number | null
          total_volume_lamports: number | null
        }
        Insert: {
          clips_uploaded?: number | null
          connected_wallets?: number | null
          created_at?: string
          daily_active_wallets?: number | null
          id?: string
          minted_tokens?: number | null
          remixed_tokens?: number | null
          revenue_lamports?: number | null
          snapshot_date: string
          snapshot_hour?: number | null
          tokens_launched?: number | null
          total_volume_lamports?: number | null
        }
        Update: {
          clips_uploaded?: number | null
          connected_wallets?: number | null
          created_at?: string
          daily_active_wallets?: number | null
          id?: string
          minted_tokens?: number | null
          remixed_tokens?: number | null
          revenue_lamports?: number | null
          snapshot_date?: string
          snapshot_hour?: number | null
          tokens_launched?: number | null
          total_volume_lamports?: number | null
        }
        Relationships: []
      }
      audio_clips: {
        Row: {
          audio_url: string
          category: string | null
          cover_image_url: string | null
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
          cover_image_url?: string | null
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
          cover_image_url?: string | null
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
      connected_wallets: {
        Row: {
          first_connected_at: string
          id: string
          last_connected_at: string
          wallet_address: string
        }
        Insert: {
          first_connected_at?: string
          id?: string
          last_connected_at?: string
          wallet_address: string
        }
        Update: {
          first_connected_at?: string
          id?: string
          last_connected_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      creator_earnings: {
        Row: {
          amount_lamports: number
          created_at: string
          id: string
          mint_address: string
          token_id: string | null
          trade_id: string | null
          wallet_address: string
        }
        Insert: {
          amount_lamports: number
          created_at?: string
          id?: string
          mint_address: string
          token_id?: string | null
          trade_id?: string | null
          wallet_address: string
        }
        Update: {
          amount_lamports?: number
          created_at?: string
          id?: string
          mint_address?: string
          token_id?: string | null
          trade_id?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_earnings_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trade_history"
            referencedColumns: ["id"]
          },
        ]
      }
      faucet_requests: {
        Row: {
          amount_lamports: number
          id: string
          requested_at: string
          tx_signature: string | null
          wallet_address: string
        }
        Insert: {
          amount_lamports: number
          id?: string
          requested_at?: string
          tx_signature?: string | null
          wallet_address: string
        }
        Update: {
          amount_lamports?: number
          id?: string
          requested_at?: string
          tx_signature?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          feature_key: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          feature_key: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          price_alerts_enabled: boolean | null
          price_threshold: number | null
          updated_at: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_alerts_enabled?: boolean | null
          price_threshold?: number | null
          updated_at?: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          price_alerts_enabled?: boolean | null
          price_threshold?: number | null
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean | null
          title: string
          token_mint: string | null
          type: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean | null
          title: string
          token_mint?: string | null
          type?: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          token_mint?: string | null
          type?: string
          wallet_address?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          wallet_address: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          wallet_address: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          wallet_address?: string
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
          cover_image_url: string | null
          created_at: string
          creator_wallet: string
          id: string
          initial_price: number
          is_active: boolean | null
          is_remix: boolean | null
          metadata_uri: string | null
          mint_address: string
          name: string
          original_token_id: string | null
          royalty_percentage: number | null
          royalty_recipient: string | null
          sol_reserves: number | null
          symbol: string
          token_reserves: number | null
          tokens_sold: number | null
          total_supply: number
          total_volume: number | null
        }
        Insert: {
          audio_clip_id?: string | null
          audio_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_wallet: string
          id?: string
          initial_price: number
          is_active?: boolean | null
          is_remix?: boolean | null
          metadata_uri?: string | null
          mint_address: string
          name: string
          original_token_id?: string | null
          royalty_percentage?: number | null
          royalty_recipient?: string | null
          sol_reserves?: number | null
          symbol: string
          token_reserves?: number | null
          tokens_sold?: number | null
          total_supply: number
          total_volume?: number | null
        }
        Update: {
          audio_clip_id?: string | null
          audio_url?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_wallet?: string
          id?: string
          initial_price?: number
          is_active?: boolean | null
          is_remix?: boolean | null
          metadata_uri?: string | null
          mint_address?: string
          name?: string
          original_token_id?: string | null
          royalty_percentage?: number | null
          royalty_recipient?: string | null
          sol_reserves?: number | null
          symbol?: string
          token_reserves?: number | null
          tokens_sold?: number | null
          total_supply?: number
          total_volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tokens_audio_clip_id_fkey"
            columns: ["audio_clip_id"]
            isOneToOne: false
            referencedRelation: "audio_clips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_original_token_id_fkey"
            columns: ["original_token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
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
      tweet_verifications: {
        Row: {
          created_at: string
          id: string
          tweet_id: string
          tweet_url: string
          verified: boolean | null
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          tweet_id: string
          tweet_url: string
          verified?: boolean | null
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          tweet_id?: string
          tweet_url?: string
          verified?: boolean | null
          wallet_address?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_level: string
          earned_at: string
          id: string
          image_url: string | null
          mint_address: string | null
          minted: boolean | null
          minted_at: string | null
          wallet_address: string
        }
        Insert: {
          badge_level: string
          earned_at?: string
          id?: string
          image_url?: string | null
          mint_address?: string | null
          minted?: boolean | null
          minted_at?: string | null
          wallet_address: string
        }
        Update: {
          badge_level?: string
          earned_at?: string
          id?: string
          image_url?: string | null
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
