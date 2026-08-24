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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      annotations: {
        Row: {
          color_code: string
          comment_text: string
          created_at: string
          end_index: number
          essay_id: string
          id: string
          start_index: number
          teacher_id: string
          updated_at: string
        }
        Insert: {
          color_code?: string
          comment_text?: string
          created_at?: string
          end_index: number
          essay_id: string
          id?: string
          start_index: number
          teacher_id: string
          updated_at?: string
        }
        Update: {
          color_code?: string
          comment_text?: string
          created_at?: string
          end_index?: number
          essay_id?: string
          id?: string
          start_index?: number
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      classrooms: {
        Row: {
          access_code: string
          created_at: string
          exit_password: string | null
          id: string
          is_active: boolean
          name: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          access_code: string
          created_at?: string
          exit_password?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          created_at?: string
          exit_password?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      coach_interventions: {
        Row: {
          coach_paused: boolean
          created_at: string
          essay_id: string
          helpfulness_rating: number | null
          id: string
          intervention_version: string | null
          issue_category: string
          model: string | null
          model_version: string | null
          paragraph_index: number | null
          participant_id: string
          question_helpfulness: string | null
          question_shown: string | null
          reflection_response: string | null
          revision_type: string | null
          snapshot_after_id: string | null
          snapshot_before_id: string | null
          suppressed_reason: string | null
          system_prompt_version: string | null
          target_paragraph_changed: boolean | null
          text_stage: string
          trigger_event: string
          updated_at: string
          user_action: string | null
          word_count: number
        }
        Insert: {
          coach_paused?: boolean
          created_at?: string
          essay_id: string
          helpfulness_rating?: number | null
          id?: string
          intervention_version?: string | null
          issue_category?: string
          model?: string | null
          model_version?: string | null
          paragraph_index?: number | null
          participant_id: string
          question_helpfulness?: string | null
          question_shown?: string | null
          reflection_response?: string | null
          revision_type?: string | null
          snapshot_after_id?: string | null
          snapshot_before_id?: string | null
          suppressed_reason?: string | null
          system_prompt_version?: string | null
          target_paragraph_changed?: boolean | null
          text_stage?: string
          trigger_event: string
          updated_at?: string
          user_action?: string | null
          word_count?: number
        }
        Update: {
          coach_paused?: boolean
          created_at?: string
          essay_id?: string
          helpfulness_rating?: number | null
          id?: string
          intervention_version?: string | null
          issue_category?: string
          model?: string | null
          model_version?: string | null
          paragraph_index?: number | null
          participant_id?: string
          question_helpfulness?: string | null
          question_shown?: string | null
          reflection_response?: string | null
          revision_type?: string | null
          snapshot_after_id?: string | null
          snapshot_before_id?: string | null
          suppressed_reason?: string | null
          system_prompt_version?: string | null
          target_paragraph_changed?: boolean | null
          text_stage?: string
          trigger_event?: string
          updated_at?: string
          user_action?: string | null
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_interventions_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_interventions_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "research_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_interventions_snapshot_after_id_fkey"
            columns: ["snapshot_after_id"]
            isOneToOne: false
            referencedRelation: "writing_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_interventions_snapshot_before_id_fkey"
            columns: ["snapshot_before_id"]
            isOneToOne: false
            referencedRelation: "writing_events"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_pause_events: {
        Row: {
          created_at: string
          essay_id: string
          id: string
          participant_id: string
          paused: boolean
          word_count: number
        }
        Insert: {
          created_at?: string
          essay_id: string
          id?: string
          participant_id: string
          paused: boolean
          word_count?: number
        }
        Update: {
          created_at?: string
          essay_id?: string
          id?: string
          participant_id?: string
          paused?: boolean
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_pause_events_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_pause_events_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "research_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      essays: {
        Row: {
          ai_checked_at: string | null
          ai_evaluation: Json | null
          ai_evaluation_at: string | null
          ai_feedback: string | null
          ai_feedback_at: string | null
          ai_probability: number | null
          classroom_id: string | null
          coach_questions_used: number
          content: string
          created_at: string
          duration_minutes: number | null
          id: string
          is_submitted: boolean
          mode: string
          pinned: boolean
          research_mode: boolean
          revision_count: number
          student_id: string
          subject: string
          text_stage: string
          topic: string
          topic_brief: Json | null
          updated_at: string
        }
        Insert: {
          ai_checked_at?: string | null
          ai_evaluation?: Json | null
          ai_evaluation_at?: string | null
          ai_feedback?: string | null
          ai_feedback_at?: string | null
          ai_probability?: number | null
          classroom_id?: string | null
          coach_questions_used?: number
          content?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_submitted?: boolean
          mode?: string
          pinned?: boolean
          research_mode?: boolean
          revision_count?: number
          student_id: string
          subject?: string
          text_stage?: string
          topic?: string
          topic_brief?: Json | null
          updated_at?: string
        }
        Update: {
          ai_checked_at?: string | null
          ai_evaluation?: Json | null
          ai_evaluation_at?: string | null
          ai_feedback?: string | null
          ai_feedback_at?: string | null
          ai_probability?: number | null
          classroom_id?: string | null
          coach_questions_used?: number
          content?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_submitted?: boolean
          mode?: string
          pinned?: boolean
          research_mode?: boolean
          revision_count?: number
          student_id?: string
          subject?: string
          text_stage?: string
          topic?: string
          topic_brief?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "essays_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string
          essay_id: string
          feedback: string
          grade: string
          id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          essay_id: string
          feedback?: string
          grade?: string
          id?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          essay_id?: string
          feedback?: string
          grade?: string
          id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: true
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          essay_id: string
          id: string
          sender: string
        }
        Insert: {
          content: string
          created_at?: string
          essay_id: string
          id?: string
          sender: string
        }
        Update: {
          content?: string
          created_at?: string
          essay_id?: string
          id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birthday: string | null
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school: string | null
          updated_at: string
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          school?: string | null
          updated_at?: string
        }
        Update: {
          birthday?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      research_participants: {
        Row: {
          consent_version: string | null
          consented_at: string | null
          created_at: string
          id: string
          participant_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_version?: string | null
          consented_at?: string | null
          created_at?: string
          id?: string
          participant_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_version?: string | null
          consented_at?: string | null
          created_at?: string
          id?: string
          participant_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      writing_events: {
        Row: {
          at: string
          chars_added: number
          created_at: string
          essay_id: string
          id: string
          is_paste: boolean
          snapshot: string
          student_id: string
          word_count: number
        }
        Insert: {
          at?: string
          chars_added?: number
          created_at?: string
          essay_id: string
          id?: string
          is_paste?: boolean
          snapshot?: string
          student_id: string
          word_count?: number
        }
        Update: {
          at?: string
          chars_added?: number
          created_at?: string
          essay_id?: string
          id?: string
          is_paste?: boolean
          snapshot?: string
          student_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "writing_events_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_research_participant: {
        Args: never
        Returns: {
          consent_version: string | null
          consented_at: string | null
          created_at: string
          id: string
          participant_code: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "research_participants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      student_owns_essay: {
        Args: { _essay_id: string; _student: string }
        Returns: boolean
      }
      teacher_owns_essay_classroom: {
        Args: { _essay_id: string; _teacher: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "teacher" | "student"
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
      app_role: ["teacher", "student"],
    },
  },
} as const
