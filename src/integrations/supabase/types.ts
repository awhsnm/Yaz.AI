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
      api_rate_limits: {
        Row: {
          called_at: string
          fn: string
          id: string
          user_id: string
        }
        Insert: {
          called_at?: string
          fn: string
          id?: string
          user_id: string
        }
        Update: {
          called_at?: string
          fn?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      assignment_collaborators: {
        Row: {
          accepted_at: string | null
          assignment_id: string
          collaborator_user_id: string | null
          id: string
          invited_at: string
          invited_by: string
          invited_email: string
          revoked_at: string | null
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          assignment_id: string
          collaborator_user_id?: string | null
          id?: string
          invited_at?: string
          invited_by: string
          invited_email: string
          revoked_at?: string | null
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          assignment_id?: string
          collaborator_user_id?: string | null
          id?: string
          invited_at?: string
          invited_by?: string
          invited_email?: string
          revoked_at?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_collaborators_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          classroom_id: string
          created_at: string
          created_by: string
          description: string | null
          due_at: string | null
          id: string
          instructions: string | null
          is_archived: boolean
          is_published: boolean
          prompt: string | null
          subject: string
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          is_archived?: boolean
          is_published?: boolean
          prompt?: string | null
          subject?: string
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          is_archived?: boolean
          is_published?: boolean
          prompt?: string | null
          subject?: string
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_allowlist: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_at: string
          last_login_at: string | null
          notes: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invited_at?: string
          last_login_at?: string | null
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_at?: string
          last_login_at?: string | null
          notes?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      beta_feedback: {
        Row: {
          admin_note: string | null
          category: string
          created_at: string
          id: string
          message: string
          page_url: string | null
          screenshot_path: string | null
          status: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          screenshot_path?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          screenshot_path?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      classroom_members: {
        Row: {
          classroom_id: string
          id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          classroom_id: string
          id?: string
          joined_at?: string
          student_id: string
        }
        Update: {
          classroom_id?: string
          id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_members_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
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
      error_logs: {
        Row: {
          created_at: string
          details: string | null
          feature: string | null
          id: string
          message: string
          page: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          feature?: string | null
          id?: string
          message: string
          page?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          feature?: string | null
          id?: string
          message?: string
          page?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      essay_activity_log: {
        Row: {
          action: string
          actor_id: string
          actor_role: string
          created_at: string
          detail: string | null
          essay_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_role: string
          created_at?: string
          detail?: string | null
          essay_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_role?: string
          created_at?: string
          detail?: string | null
          essay_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_activity_log_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_rubric_scores: {
        Row: {
          comment: string | null
          created_at: string
          criterion: string
          essay_id: string
          id: string
          max_score: number
          position: number
          score: number | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          criterion: string
          essay_id: string
          id?: string
          max_score?: number
          position?: number
          score?: number | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          criterion?: string
          essay_id?: string
          id?: string
          max_score?: number
          position?: number
          score?: number | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "essay_rubric_scores_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_student_feedback: {
        Row: {
          created_at: string
          essay_id: string
          feedback_text: string | null
          generated_at: string
          id: string
          model_version: string | null
          next_step_for_revision: string | null
          prompt_version: string | null
          revision_question: string | null
          student_id: string
          updated_at: string
          what_is_working_well: Json
        }
        Insert: {
          created_at?: string
          essay_id: string
          feedback_text?: string | null
          generated_at?: string
          id?: string
          model_version?: string | null
          next_step_for_revision?: string | null
          prompt_version?: string | null
          revision_question?: string | null
          student_id: string
          updated_at?: string
          what_is_working_well?: Json
        }
        Update: {
          created_at?: string
          essay_id?: string
          feedback_text?: string | null
          generated_at?: string
          id?: string
          model_version?: string | null
          next_step_for_revision?: string | null
          prompt_version?: string | null
          revision_question?: string | null
          student_id?: string
          updated_at?: string
          what_is_working_well?: Json
        }
        Relationships: [
          {
            foreignKeyName: "essay_student_feedback_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: true
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_submissions: {
        Row: {
          ai_questions_shown: number
          ai_student_responses: number
          classroom_id: string | null
          content: string
          essay_id: string
          id: string
          student_id: string
          subject: string
          submitted_at: string
          topic: string
          version: number
          word_count: number
        }
        Insert: {
          ai_questions_shown?: number
          ai_student_responses?: number
          classroom_id?: string | null
          content: string
          essay_id: string
          id?: string
          student_id: string
          subject: string
          submitted_at?: string
          topic: string
          version: number
          word_count?: number
        }
        Update: {
          ai_questions_shown?: number
          ai_student_responses?: number
          classroom_id?: string | null
          content?: string
          essay_id?: string
          id?: string
          student_id?: string
          subject?: string
          submitted_at?: string
          topic?: string
          version?: number
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "essay_submissions_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: false
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
        ]
      }
      essay_teacher_assessments: {
        Row: {
          ai_coach_paused: boolean | null
          ai_prompt_topics: Json
          ai_questions_answered: number | null
          ai_questions_not_now: number | null
          ai_questions_shown: number | null
          ai_questions_skipped: number | null
          ai_revision_confidence: string | null
          ai_suggested_revision_type: string | null
          ai_support_interpretation: string | null
          ai_support_label: string | null
          assessment_confidence: string | null
          conventions_confidence: string | null
          conventions_rationale: string | null
          conventions_score: number | null
          created_at: string
          essay_id: string
          final_word_count: number | null
          generated_at: string
          id: string
          ideas_reasoning_confidence: string | null
          ideas_reasoning_rationale: string | null
          ideas_reasoning_score: number | null
          meaningful_revision_count: number | null
          model_version: string | null
          organization_confidence: string | null
          organization_rationale: string | null
          organization_score: number | null
          paragraph_count: number | null
          possible_teacher_questions: Json
          priority_improvement_areas: Json
          prompt_version: string | null
          researcher_coded_revision_type: string | null
          sentence_fluency_confidence: string | null
          sentence_fluency_rationale: string | null
          sentence_fluency_score: number | null
          strongest_arguments: Json
          submitted_at: string | null
          teacher_confirmed_revision_type: string | null
          updated_at: string
          voice_confidence: string | null
          voice_rationale: string | null
          voice_score: number | null
          word_choice_clarity_confidence: string | null
          word_choice_clarity_rationale: string | null
          word_choice_clarity_score: number | null
          writing_duration_seconds: number | null
        }
        Insert: {
          ai_coach_paused?: boolean | null
          ai_prompt_topics?: Json
          ai_questions_answered?: number | null
          ai_questions_not_now?: number | null
          ai_questions_shown?: number | null
          ai_questions_skipped?: number | null
          ai_revision_confidence?: string | null
          ai_suggested_revision_type?: string | null
          ai_support_interpretation?: string | null
          ai_support_label?: string | null
          assessment_confidence?: string | null
          conventions_confidence?: string | null
          conventions_rationale?: string | null
          conventions_score?: number | null
          created_at?: string
          essay_id: string
          final_word_count?: number | null
          generated_at?: string
          id?: string
          ideas_reasoning_confidence?: string | null
          ideas_reasoning_rationale?: string | null
          ideas_reasoning_score?: number | null
          meaningful_revision_count?: number | null
          model_version?: string | null
          organization_confidence?: string | null
          organization_rationale?: string | null
          organization_score?: number | null
          paragraph_count?: number | null
          possible_teacher_questions?: Json
          priority_improvement_areas?: Json
          prompt_version?: string | null
          researcher_coded_revision_type?: string | null
          sentence_fluency_confidence?: string | null
          sentence_fluency_rationale?: string | null
          sentence_fluency_score?: number | null
          strongest_arguments?: Json
          submitted_at?: string | null
          teacher_confirmed_revision_type?: string | null
          updated_at?: string
          voice_confidence?: string | null
          voice_rationale?: string | null
          voice_score?: number | null
          word_choice_clarity_confidence?: string | null
          word_choice_clarity_rationale?: string | null
          word_choice_clarity_score?: number | null
          writing_duration_seconds?: number | null
        }
        Update: {
          ai_coach_paused?: boolean | null
          ai_prompt_topics?: Json
          ai_questions_answered?: number | null
          ai_questions_not_now?: number | null
          ai_questions_shown?: number | null
          ai_questions_skipped?: number | null
          ai_revision_confidence?: string | null
          ai_suggested_revision_type?: string | null
          ai_support_interpretation?: string | null
          ai_support_label?: string | null
          assessment_confidence?: string | null
          conventions_confidence?: string | null
          conventions_rationale?: string | null
          conventions_score?: number | null
          created_at?: string
          essay_id?: string
          final_word_count?: number | null
          generated_at?: string
          id?: string
          ideas_reasoning_confidence?: string | null
          ideas_reasoning_rationale?: string | null
          ideas_reasoning_score?: number | null
          meaningful_revision_count?: number | null
          model_version?: string | null
          organization_confidence?: string | null
          organization_rationale?: string | null
          organization_score?: number | null
          paragraph_count?: number | null
          possible_teacher_questions?: Json
          priority_improvement_areas?: Json
          prompt_version?: string | null
          researcher_coded_revision_type?: string | null
          sentence_fluency_confidence?: string | null
          sentence_fluency_rationale?: string | null
          sentence_fluency_score?: number | null
          strongest_arguments?: Json
          submitted_at?: string | null
          teacher_confirmed_revision_type?: string | null
          updated_at?: string
          voice_confidence?: string | null
          voice_rationale?: string | null
          voice_score?: number | null
          word_choice_clarity_confidence?: string | null
          word_choice_clarity_rationale?: string | null
          word_choice_clarity_score?: number | null
          writing_duration_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "essay_teacher_assessments_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: true
            referencedRelation: "essays"
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
          assignment_id: string | null
          classroom_id: string | null
          coach_questions_used: number
          content: string
          created_at: string
          duration_minutes: number | null
          graded_at: string | null
          id: string
          is_submitted: boolean
          mode: string
          pinned: boolean
          research_mode: boolean
          returned_at: string | null
          revision_count: number
          shared_at: string | null
          shared_with_classroom_id: string | null
          student_id: string
          subject: string
          submission_version: number
          submitted_at: string | null
          text_stage: string
          topic: string
          topic_brief: Json | null
          updated_at: string
          visibility: string
        }
        Insert: {
          ai_checked_at?: string | null
          ai_evaluation?: Json | null
          ai_evaluation_at?: string | null
          ai_feedback?: string | null
          ai_feedback_at?: string | null
          ai_probability?: number | null
          assignment_id?: string | null
          classroom_id?: string | null
          coach_questions_used?: number
          content?: string
          created_at?: string
          duration_minutes?: number | null
          graded_at?: string | null
          id?: string
          is_submitted?: boolean
          mode?: string
          pinned?: boolean
          research_mode?: boolean
          returned_at?: string | null
          revision_count?: number
          shared_at?: string | null
          shared_with_classroom_id?: string | null
          student_id: string
          subject?: string
          submission_version?: number
          submitted_at?: string | null
          text_stage?: string
          topic?: string
          topic_brief?: Json | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          ai_checked_at?: string | null
          ai_evaluation?: Json | null
          ai_evaluation_at?: string | null
          ai_feedback?: string | null
          ai_feedback_at?: string | null
          ai_probability?: number | null
          assignment_id?: string | null
          classroom_id?: string | null
          coach_questions_used?: number
          content?: string
          created_at?: string
          duration_minutes?: number | null
          graded_at?: string | null
          id?: string
          is_submitted?: boolean
          mode?: string
          pinned?: boolean
          research_mode?: boolean
          returned_at?: string | null
          revision_count?: number
          shared_at?: string | null
          shared_with_classroom_id?: string | null
          student_id?: string
          subject?: string
          submission_version?: number
          submitted_at?: string | null
          text_stage?: string
          topic?: string
          topic_brief?: Json | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "essays_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "essays_shared_with_classroom_id_fkey"
            columns: ["shared_with_classroom_id"]
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
      login_events: {
        Row: {
          created_at: string
          id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      research_questionnaires: {
        Row: {
          answers: Json
          created_at: string
          essay_id: string
          id: string
          participant_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          essay_id: string
          id?: string
          participant_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          essay_id?: string
          id?: string
          participant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_questionnaires_essay_id_fkey"
            columns: ["essay_id"]
            isOneToOne: true
            referencedRelation: "essays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_questionnaires_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "research_participants"
            referencedColumns: ["id"]
          },
        ]
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
      accept_assignment_invitations: { Args: never; Returns: number }
      beta_progress: {
        Args: never
        Returns: {
          email: string
          essay_count: number
          feedback_count: number
          full_name: string
          invited_at: string
          last_login_at: string
          role: Database["public"]["Enums"]["app_role"]
          signed_up: boolean
          status: string
          submitted_count: number
        }[]
      }
      collaborator_can_access_essay: {
        Args: { _essay_id: string; _user_id?: string }
        Returns: boolean
      }
      collaborator_can_view_student: {
        Args: { _student: string; _user_id?: string }
        Returns: boolean
      }
      current_user_email: { Args: never; Returns: string }
      enroll_in_classroom: {
        Args: { _code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
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
      is_accepted_assignment_collaborator: {
        Args: { _assignment_id: string; _user_id?: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_beta_active: { Args: { _user_id: string }; Returns: boolean }
      is_classroom_member: {
        Args: { _classroom_id: string; _student?: string }
        Returns: boolean
      }
      join_classroom_by_code: {
        Args: { _code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      list_classroom_assignments: {
        Args: { _code: string }
        Returns: {
          classroom_id: string
          classroom_name: string
          description: string
          due_at: string
          essay_id: string
          id: string
          instructions: string
          is_submitted: boolean
          prompt: string
          subject: string
          time_limit_minutes: number
          title: string
        }[]
      }
      mark_essay_graded: {
        Args: { _essay_id: string; _feedback?: string; _grade: string }
        Returns: string
      }
      my_classrooms: {
        Args: never
        Returns: {
          classroom_id: string
          classroom_name: string
          teacher_name: string
        }[]
      }
      owns_assignment: {
        Args: { _assignment_id: string; _user?: string }
        Returns: boolean
      }
      record_beta_login: { Args: { _user_agent?: string }; Returns: string }
      return_essay_for_revision: {
        Args: { _comment?: string; _essay_id: string }
        Returns: string
      }
      share_essay_with_teacher: {
        Args: { _classroom_id?: string; _essay_id: string }
        Returns: string
      }
      start_assignment_essay: {
        Args: { _assignment_id: string; _code: string; _subject?: string }
        Returns: string
      }
      student_in_classroom: {
        Args: { _classroom_id: string; _student?: string }
        Returns: boolean
      }
      student_owns_essay: {
        Args: { _essay_id: string; _student: string }
        Returns: boolean
      }
      submit_classroom_essay: {
        Args: { _essay_id: string; _password?: string }
        Returns: boolean
      }
      submit_essay_for_grading: {
        Args: { _classroom_id?: string; _essay_id: string }
        Returns: string
      }
      teacher_can_access_shared_essay: {
        Args: { _essay_id: string; _teacher?: string }
        Returns: boolean
      }
      teacher_can_view_student: { Args: { _student: string }; Returns: boolean }
      teacher_owns_classroom: {
        Args: { _classroom_id: string; _teacher?: string }
        Returns: boolean
      }
      teacher_owns_essay_classroom: {
        Args: { _essay_id: string; _teacher: string }
        Returns: boolean
      }
      unshare_essay: { Args: { _essay_id: string }; Returns: string }
    }
    Enums: {
      app_role: "teacher" | "student" | "admin"
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
      app_role: ["teacher", "student", "admin"],
    },
  },
} as const
