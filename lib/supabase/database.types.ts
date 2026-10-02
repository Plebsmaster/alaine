export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_usage: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          function: string;
          id: number;
          input_tokens: number;
          model: string;
          ok: boolean;
          output_tokens: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          function: string;
          id?: never;
          input_tokens?: number;
          model: string;
          ok?: boolean;
          output_tokens?: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          duration_ms?: number | null;
          function?: string;
          id?: never;
          input_tokens?: number;
          model?: string;
          ok?: boolean;
          output_tokens?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      card_objectives: {
        Row: {
          card_id: string;
          objective_id: string;
          user_id: string;
        };
        Insert: {
          card_id: string;
          objective_id: string;
          user_id?: string;
        };
        Update: {
          card_id?: string;
          objective_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_objectives_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "card_objectives_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "review_queue";
            referencedColumns: ["card_id"];
          },
          {
            foreignKeyName: "card_objectives_objective_id_fkey";
            columns: ["objective_id"];
            isOneToOne: false;
            referencedRelation: "learning_objectives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "card_objectives_objective_id_fkey";
            columns: ["objective_id"];
            isOneToOne: false;
            referencedRelation: "objective_coverage";
            referencedColumns: ["objective_id"];
          },
        ];
      };
      card_schedule: {
        Row: {
          card_id: string;
          difficulty: number;
          due: string;
          elapsed_days: number;
          lapses: number;
          last_review: string | null;
          learning_steps: number;
          reps: number;
          scheduled_days: number;
          stability: number;
          state: number;
          user_id: string;
        };
        Insert: {
          card_id: string;
          difficulty?: number;
          due?: string;
          elapsed_days?: number;
          lapses?: number;
          last_review?: string | null;
          learning_steps?: number;
          reps?: number;
          scheduled_days?: number;
          stability?: number;
          state?: number;
          user_id?: string;
        };
        Update: {
          card_id?: string;
          difficulty?: number;
          due?: string;
          elapsed_days?: number;
          lapses?: number;
          last_review?: string | null;
          learning_steps?: number;
          reps?: number;
          scheduled_days?: number;
          stability?: number;
          state?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_schedule_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: true;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "card_schedule_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: true;
            referencedRelation: "review_queue";
            referencedColumns: ["card_id"];
          },
        ];
      };
      cards: {
        Row: {
          back: string;
          created_at: string;
          explanation: string | null;
          external_id: string | null;
          flag_note: string | null;
          front: string;
          id: string;
          illness_script_id: string | null;
          image_path: string | null;
          needs_verification: boolean;
          origin: string;
          rewritten: boolean;
          script_field: string | null;
          source_id: string | null;
          source_locator: string | null;
          status: string;
          tags: string[];
          topic_id: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          back: string;
          created_at?: string;
          explanation?: string | null;
          external_id?: string | null;
          flag_note?: string | null;
          front: string;
          id?: string;
          illness_script_id?: string | null;
          image_path?: string | null;
          needs_verification?: boolean;
          origin?: string;
          rewritten?: boolean;
          script_field?: string | null;
          source_id?: string | null;
          source_locator?: string | null;
          status?: string;
          tags?: string[];
          topic_id: string;
          type: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          back?: string;
          created_at?: string;
          explanation?: string | null;
          external_id?: string | null;
          flag_note?: string | null;
          front?: string;
          id?: string;
          illness_script_id?: string | null;
          image_path?: string | null;
          needs_verification?: boolean;
          origin?: string;
          rewritten?: boolean;
          script_field?: string | null;
          source_id?: string | null;
          source_locator?: string | null;
          status?: string;
          tags?: string[];
          topic_id?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cards_illness_script_id_fkey";
            columns: ["illness_script_id"];
            isOneToOne: false;
            referencedRelation: "illness_scripts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cards_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cards_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      case_attempts: {
        Row: {
          ai_feedback: string | null;
          case_id: string;
          correct: boolean | null;
          created_at: string;
          cued: boolean;
          duration_ms: number | null;
          error_type: string | null;
          final_ranking: string[];
          hints_used: number;
          id: string;
          reflection: NonNullable<Json>;
          self_score: number | null;
          session_id: string | null;
          user_id: string;
          working_diagnosis: string | null;
        };
        Insert: {
          ai_feedback?: string | null;
          case_id: string;
          correct?: boolean | null;
          created_at?: string;
          cued?: boolean;
          duration_ms?: number | null;
          error_type?: string | null;
          final_ranking?: string[];
          hints_used?: number;
          id?: string;
          reflection?: NonNullable<Json>;
          self_score?: number | null;
          session_id?: string | null;
          user_id?: string;
          working_diagnosis?: string | null;
        };
        Update: {
          ai_feedback?: string | null;
          case_id?: string;
          correct?: boolean | null;
          created_at?: string;
          cued?: boolean;
          duration_ms?: number | null;
          error_type?: string | null;
          final_ranking?: string[];
          hints_used?: number;
          id?: string;
          reflection?: NonNullable<Json>;
          self_score?: number | null;
          session_id?: string | null;
          user_id?: string;
          working_diagnosis?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "case_attempts_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
        ];
      };
      case_objectives: {
        Row: {
          case_id: string;
          objective_id: string;
          user_id: string;
        };
        Insert: {
          case_id: string;
          objective_id: string;
          user_id?: string;
        };
        Update: {
          case_id?: string;
          objective_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_objectives_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_objectives_objective_id_fkey";
            columns: ["objective_id"];
            isOneToOne: false;
            referencedRelation: "learning_objectives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_objectives_objective_id_fkey";
            columns: ["objective_id"];
            isOneToOne: false;
            referencedRelation: "objective_coverage";
            referencedColumns: ["objective_id"];
          },
        ];
      };
      cases: {
        Row: {
          correct_diagnosis: string;
          created_at: string;
          difficulty: number | null;
          expert_reflection: NonNullable<Json>;
          external_id: string | null;
          from_internship: boolean;
          id: string;
          needs_verification: boolean;
          origin: string;
          question: string;
          source_id: string | null;
          status: string;
          teaching_points: string | null;
          title: string;
          topic_id: string;
          updated_at: string;
          user_id: string;
          vignette: string;
        };
        Insert: {
          correct_diagnosis: string;
          created_at?: string;
          difficulty?: number | null;
          expert_reflection?: NonNullable<Json>;
          external_id?: string | null;
          from_internship?: boolean;
          id?: string;
          needs_verification?: boolean;
          origin?: string;
          question?: string;
          source_id?: string | null;
          status?: string;
          teaching_points?: string | null;
          title: string;
          topic_id: string;
          updated_at?: string;
          user_id?: string;
          vignette: string;
        };
        Update: {
          correct_diagnosis?: string;
          created_at?: string;
          difficulty?: number | null;
          expert_reflection?: NonNullable<Json>;
          external_id?: string | null;
          from_internship?: boolean;
          id?: string;
          needs_verification?: boolean;
          origin?: string;
          question?: string;
          source_id?: string | null;
          status?: string;
          teaching_points?: string | null;
          title?: string;
          topic_id?: string;
          updated_at?: string;
          user_id?: string;
          vignette?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cases_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cases_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      illness_scripts: {
        Row: {
          condition: string;
          created_at: string;
          epidemiology: string | null;
          external_id: string | null;
          findings: string | null;
          id: string;
          key_discriminators: string | null;
          management: string | null;
          needs_verification: boolean;
          origin: string;
          pathophysiology: string | null;
          presentation: string | null;
          similar_conditions: string[];
          source_id: string | null;
          source_locator: string | null;
          status: string;
          topic_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          condition: string;
          created_at?: string;
          epidemiology?: string | null;
          external_id?: string | null;
          findings?: string | null;
          id?: string;
          key_discriminators?: string | null;
          management?: string | null;
          needs_verification?: boolean;
          origin?: string;
          pathophysiology?: string | null;
          presentation?: string | null;
          similar_conditions?: string[];
          source_id?: string | null;
          source_locator?: string | null;
          status?: string;
          topic_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          condition?: string;
          created_at?: string;
          epidemiology?: string | null;
          external_id?: string | null;
          findings?: string | null;
          id?: string;
          key_discriminators?: string | null;
          management?: string | null;
          needs_verification?: boolean;
          origin?: string;
          pathophysiology?: string | null;
          presentation?: string | null;
          similar_conditions?: string[];
          source_id?: string | null;
          source_locator?: string | null;
          status?: string;
          topic_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "illness_scripts_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "illness_scripts_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_objectives: {
        Row: {
          code: string | null;
          created_at: string;
          description: string;
          external_id: string | null;
          id: string;
          sort_order: number;
          topic_id: string;
          user_id: string;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          description: string;
          external_id?: string | null;
          id?: string;
          sort_order?: number;
          topic_id: string;
          user_id?: string;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          description?: string;
          external_id?: string | null;
          id?: string;
          sort_order?: number;
          topic_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_objectives_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      modules: {
        Row: {
          created_at: string;
          exam_date: string | null;
          external_id: string | null;
          id: string;
          name: string;
          sort_order: number;
          study_year: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          exam_date?: string | null;
          external_id?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          study_year?: number | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          exam_date?: string | null;
          external_id?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          study_year?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      question_attempts: {
        Row: {
          ai_feedback: string | null;
          answer_text: string | null;
          chosen_option: number | null;
          correct: boolean | null;
          created_at: string;
          error_type: string | null;
          id: string;
          question_id: string;
          session_id: string | null;
          user_id: string;
        };
        Insert: {
          ai_feedback?: string | null;
          answer_text?: string | null;
          chosen_option?: number | null;
          correct?: boolean | null;
          created_at?: string;
          error_type?: string | null;
          id?: string;
          question_id: string;
          session_id?: string | null;
          user_id?: string;
        };
        Update: {
          ai_feedback?: string | null;
          answer_text?: string | null;
          chosen_option?: number | null;
          correct?: boolean | null;
          created_at?: string;
          error_type?: string | null;
          id?: string;
          question_id?: string;
          session_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_attempts_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      question_objectives: {
        Row: {
          objective_id: string;
          question_id: string;
          user_id: string;
        };
        Insert: {
          objective_id: string;
          question_id: string;
          user_id?: string;
        };
        Update: {
          objective_id?: string;
          question_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_objectives_objective_id_fkey";
            columns: ["objective_id"];
            isOneToOne: false;
            referencedRelation: "learning_objectives";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_objectives_objective_id_fkey";
            columns: ["objective_id"];
            isOneToOne: false;
            referencedRelation: "objective_coverage";
            referencedColumns: ["objective_id"];
          },
          {
            foreignKeyName: "question_objectives_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          correct_option: number | null;
          created_at: string;
          explanation: string | null;
          external_id: string | null;
          format: string;
          id: string;
          kind: string;
          model_answer: string | null;
          needs_verification: boolean;
          options: Json | null;
          origin: string;
          source_id: string | null;
          status: string;
          stem: string;
          topic_id: string;
          user_id: string;
        };
        Insert: {
          correct_option?: number | null;
          created_at?: string;
          explanation?: string | null;
          external_id?: string | null;
          format: string;
          id?: string;
          kind: string;
          model_answer?: string | null;
          needs_verification?: boolean;
          options?: Json | null;
          origin?: string;
          source_id?: string | null;
          status?: string;
          stem: string;
          topic_id: string;
          user_id?: string;
        };
        Update: {
          correct_option?: number | null;
          created_at?: string;
          explanation?: string | null;
          external_id?: string | null;
          format?: string;
          id?: string;
          kind?: string;
          model_answer?: string | null;
          needs_verification?: boolean;
          options?: Json | null;
          origin?: string;
          source_id?: string | null;
          status?: string;
          stem?: string;
          topic_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      review_logs: {
        Row: {
          ai_feedback: string | null;
          answer_text: string | null;
          card_id: string;
          difficulty: number;
          due: string;
          duration_ms: number | null;
          elapsed_days: number;
          error_type: string | null;
          id: number;
          last_elapsed_days: number;
          learning_steps: number;
          rating: number;
          review: string;
          scheduled_days: number;
          session_id: string | null;
          stability: number;
          state: number;
          user_id: string;
        };
        Insert: {
          ai_feedback?: string | null;
          answer_text?: string | null;
          card_id: string;
          difficulty: number;
          due: string;
          duration_ms?: number | null;
          elapsed_days?: number;
          error_type?: string | null;
          id?: never;
          last_elapsed_days?: number;
          learning_steps?: number;
          rating: number;
          review?: string;
          scheduled_days?: number;
          session_id?: string | null;
          stability: number;
          state: number;
          user_id?: string;
        };
        Update: {
          ai_feedback?: string | null;
          answer_text?: string | null;
          card_id?: string;
          difficulty?: number;
          due?: string;
          duration_ms?: number | null;
          elapsed_days?: number;
          error_type?: string | null;
          id?: never;
          last_elapsed_days?: number;
          learning_steps?: number;
          rating?: number;
          review?: string;
          scheduled_days?: number;
          session_id?: string | null;
          stability?: number;
          state?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_logs_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_logs_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "review_queue";
            referencedColumns: ["card_id"];
          },
        ];
      };
      settings: {
        Row: {
          desired_retention: number;
          fsrs_params: Json | null;
          max_new_per_day: number;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          desired_retention?: number;
          fsrs_params?: Json | null;
          max_new_per_day?: number;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          desired_retention?: number;
          fsrs_params?: Json | null;
          max_new_per_day?: number;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sources: {
        Row: {
          author: string | null;
          chapter: string | null;
          created_at: string;
          external_id: string | null;
          id: string;
          kind: string;
          notes: string | null;
          pages: string | null;
          title: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          author?: string | null;
          chapter?: string | null;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          kind?: string;
          notes?: string | null;
          pages?: string | null;
          title: string;
          url?: string | null;
          user_id?: string;
        };
        Update: {
          author?: string | null;
          chapter?: string | null;
          created_at?: string;
          external_id?: string | null;
          id?: string;
          kind?: string;
          notes?: string | null;
          pages?: string | null;
          title?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      study_sessions: {
        Row: {
          ended_at: string | null;
          id: string;
          items: number;
          kind: string;
          started_at: string;
          user_id: string;
        };
        Insert: {
          ended_at?: string | null;
          id?: string;
          items?: number;
          kind: string;
          started_at?: string;
          user_id?: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          items?: number;
          kind?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      topics: {
        Row: {
          created_at: string;
          external_id: string | null;
          id: string;
          module_id: string;
          name: string;
          sort_order: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          external_id?: string | null;
          id?: string;
          module_id: string;
          name: string;
          sort_order?: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          external_id?: string | null;
          id?: string;
          module_id?: string;
          name?: string;
          sort_order?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "topics_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      objective_coverage: {
        Row: {
          active_cards: number | null;
          active_cases: number | null;
          objective_id: string | null;
          topic_id: string | null;
        };
        Insert: {
          active_cards?: never;
          active_cases?: never;
          objective_id?: string | null;
          topic_id?: string | null;
        };
        Update: {
          active_cards?: never;
          active_cases?: never;
          objective_id?: string | null;
          topic_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "learning_objectives_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      review_queue: {
        Row: {
          back: string | null;
          card_id: string | null;
          created_at: string | null;
          difficulty: number | null;
          due: string | null;
          elapsed_days: number | null;
          exam_date: string | null;
          explanation: string | null;
          front: string | null;
          image_path: string | null;
          lapses: number | null;
          last_review: string | null;
          learning_steps: number | null;
          module_sort: number | null;
          needs_verification: boolean | null;
          objective_sort: number | null;
          reps: number | null;
          scheduled_days: number | null;
          source_label: string | null;
          source_locator: string | null;
          stability: number | null;
          state: number | null;
          topic_id: string | null;
          topic_name: string | null;
          topic_sort: number | null;
          type: string | null;
          upcoming_exam_date: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cards_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      topic_card_counts: {
        Row: {
          active: number | null;
          draft: number | null;
          suspended: number | null;
          topic_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cards_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      _import_objective: {
        Args: { p_external_id: string; p_uid: string; r: Json };
        Returns: string;
      };
      _import_result: {
        Args: { p_id: string; p_inserted: boolean; p_kind: string; r: Json };
        Returns: Json;
      };
      _import_source: { Args: { p_uid: string; r: Json }; Returns: string };
      _import_topic: { Args: { p_uid: string; r: Json }; Returns: string };
      approve_card: {
        Args: {
          p_back: string;
          p_card_id: string;
          p_explanation: string;
          p_front: string;
          p_schedule: Json;
        };
        Returns: undefined;
      };
      approve_illness_script: {
        Args: { p_script_id: string };
        Returns: number;
      };
      import_bundle: {
        Args: { p_payload: Json; p_user_id?: string };
        Returns: Json;
      };
      rate_card: {
        Args: {
          p_ai_feedback?: string;
          p_answer_text?: string;
          p_card_id: string;
          p_duration_ms?: number;
          p_error_type?: string;
          p_log: Json;
          p_schedule: Json;
          p_session_id?: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
