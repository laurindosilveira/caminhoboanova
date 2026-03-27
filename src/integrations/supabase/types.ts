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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievement_unlocks: {
        Row: {
          achievement_key: string
          bonus_points: number
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          bonus_points?: number
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          bonus_points?: number
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          created_at: string
          id: string
          order_num: number
          points: number
          subtitle: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_num: number
          points?: number
          subtitle?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          order_num?: number
          points?: number
          subtitle?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      activity_removal_log: {
        Row: {
          activity_id: string
          activity_title: string
          activity_type: string
          id: string
          notes: string | null
          points_removed: number
          removed_at: string
          removed_by: string
          target_user_id: string
        }
        Insert: {
          activity_id: string
          activity_title?: string
          activity_type: string
          id?: string
          notes?: string | null
          points_removed?: number
          removed_at?: string
          removed_by: string
          target_user_id: string
        }
        Update: {
          activity_id?: string
          activity_title?: string
          activity_type?: string
          id?: string
          notes?: string | null
          points_removed?: number
          removed_at?: string
          removed_by?: string
          target_user_id?: string
        }
        Relationships: []
      }
      area_pastors: {
        Row: {
          area: string
          id: string
          pastor_name: string
          phone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area: string
          id?: string
          pastor_name?: string
          phone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area?: string
          id?: string
          pastor_name?: string
          phone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string
          event_id: string
          id: string
          justification: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          justification?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          justification?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          completed: boolean
          completed_at: string | null
          file_url: string | null
          id: string
          joined_at: string
          response_text: string | null
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          file_url?: string | null
          id?: string
          joined_at?: string
          response_text?: string | null
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          file_url?: string | null
          id?: string
          joined_at?: string
          response_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "community_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      church_subscriptions: {
        Row: {
          activities: string | null
          average_age: string | null
          church_address: string | null
          church_email: string
          church_name: string
          church_phone: string | null
          created_at: string
          id: string
          member_count: string | null
          needs: string | null
          objectives: string | null
          pastor_email: string | null
          pastor_name: string
          pastor_phone: string | null
          pastor_role: string | null
          preferences: string | null
          recommended_plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          activities?: string | null
          average_age?: string | null
          church_address?: string | null
          church_email: string
          church_name: string
          church_phone?: string | null
          created_at?: string
          id?: string
          member_count?: string | null
          needs?: string | null
          objectives?: string | null
          pastor_email?: string | null
          pastor_name: string
          pastor_phone?: string | null
          pastor_role?: string | null
          preferences?: string | null
          recommended_plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          activities?: string | null
          average_age?: string | null
          church_address?: string | null
          church_email?: string
          church_name?: string
          church_phone?: string | null
          created_at?: string
          id?: string
          member_count?: string | null
          needs?: string | null
          objectives?: string | null
          pastor_email?: string | null
          pastor_name?: string
          pastor_phone?: string | null
          pastor_role?: string | null
          preferences?: string | null
          recommended_plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      community_challenges: {
        Row: {
          area: string | null
          community: string | null
          created_at: string
          created_by: string | null
          description: string | null
          emoji: string
          end_date: string
          id: string
          requires_file: boolean
          requires_text: boolean
          start_date: string
          title: string
        }
        Insert: {
          area?: string | null
          community?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string
          end_date: string
          id?: string
          requires_file?: boolean
          requires_text?: boolean
          start_date: string
          title: string
        }
        Update: {
          area?: string | null
          community?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string
          end_date?: string
          id?: string
          requires_file?: boolean
          requires_text?: boolean
          start_date?: string
          title?: string
        }
        Relationships: []
      }
      community_chat: {
        Row: {
          community: string
          created_at: string
          file_type: string | null
          file_url: string | null
          id: string
          message: string
          reply_to: string | null
          reply_to_name: string | null
          reply_to_text: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          community: string
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          message: string
          reply_to?: string | null
          reply_to_name?: string | null
          reply_to_text?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          community?: string
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          message?: string
          reply_to?: string | null
          reply_to_name?: string | null
          reply_to_text?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_chat_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "community_chat"
            referencedColumns: ["id"]
          },
        ]
      }
      community_settings: {
        Row: {
          community: string
          id: string
          updated_at: string
          updated_by: string | null
          verse_of_week: string | null
          verse_reference: string | null
          whatsapp_link: string | null
        }
        Insert: {
          community: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          verse_of_week?: string | null
          verse_reference?: string | null
          whatsapp_link?: string | null
        }
        Update: {
          community?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          verse_of_week?: string | null
          verse_reference?: string | null
          whatsapp_link?: string | null
        }
        Relationships: []
      }
      course_unlocks: {
        Row: {
          area: string
          course_id: string
          id: string
          unlocked_at: string
          unlocked_by: string
        }
        Insert: {
          area: string
          course_id: string
          id?: string
          unlocked_at?: string
          unlocked_by: string
        }
        Update: {
          area?: string
          course_id?: string
          id?: string
          unlocked_at?: string
          unlocked_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_unlocks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          id: string
          order_num: number
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_num: number
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          order_num?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      devotional_content: {
        Row: {
          activity_id: string | null
          bible_reference: string
          bible_text: string
          created_at: string
          day_number: number
          id: string
          lesson_id: string | null
          practice: string
          prayer: string
          questions: string[]
          reflection: string
          title: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          bible_reference?: string
          bible_text?: string
          created_at?: string
          day_number?: number
          id?: string
          lesson_id?: string | null
          practice?: string
          prayer?: string
          questions?: string[]
          reflection?: string
          title?: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          bible_reference?: string
          bible_text?: string
          created_at?: string
          day_number?: number
          id?: string
          lesson_id?: string | null
          practice?: string
          prayer?: string
          questions?: string[]
          reflection?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devotional_content_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      devotional_progress: {
        Row: {
          completed_at: string
          devotional_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          devotional_id: string
          id?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          devotional_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devotional_progress_devotional_id_fkey"
            columns: ["devotional_id"]
            isOneToOne: false
            referencedRelation: "devotional_content"
            referencedColumns: ["id"]
          },
        ]
      }
      discipleship_plans: {
        Row: {
          aptidao: string | null
          challenges: string | null
          created_at: string
          health_status: string
          id: string
          is_priority: boolean
          last_contact_at: string | null
          next_steps: string | null
          objectives: string | null
          pastor_notes: string | null
          recommendations: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aptidao?: string | null
          challenges?: string | null
          created_at?: string
          health_status?: string
          id?: string
          is_priority?: boolean
          last_contact_at?: string | null
          next_steps?: string | null
          objectives?: string | null
          pastor_notes?: string | null
          recommendations?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aptidao?: string | null
          challenges?: string | null
          created_at?: string
          health_status?: string
          id?: string
          is_priority?: boolean
          last_contact_at?: string | null
          next_steps?: string | null
          objectives?: string | null
          pastor_notes?: string | null
          recommendations?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_photos: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string
          file_url: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id: string
          file_url: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string
          file_url?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          area: string | null
          community: string | null
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          id: string
          linked_lesson_id: string | null
          location: string | null
          target_user_id: string | null
          title: string
          type: string
        }
        Insert: {
          area?: string | null
          community?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date: string
          id?: string
          linked_lesson_id?: string | null
          location?: string | null
          target_user_id?: string | null
          title: string
          type?: string
        }
        Update: {
          area?: string | null
          community?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          linked_lesson_id?: string | null
          location?: string | null
          target_user_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_linked_lesson_id_fkey"
            columns: ["linked_lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_guide: {
        Row: {
          bible_texts: string[]
          created_at: string
          greeting: string
          icebreaker: string
          id: string
          lesson_id: string
          practice: string
          prayer_prompt: string
          questions: string[]
          summary: string
          updated_at: string
        }
        Insert: {
          bible_texts?: string[]
          created_at?: string
          greeting?: string
          icebreaker?: string
          id?: string
          lesson_id: string
          practice?: string
          prayer_prompt?: string
          questions?: string[]
          summary?: string
          updated_at?: string
        }
        Update: {
          bible_texts?: string[]
          created_at?: string
          greeting?: string
          icebreaker?: string
          id?: string
          lesson_id?: string
          practice?: string
          prayer_prompt?: string
          questions?: string[]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_guide_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_meeting_notes: {
        Row: {
          created_at: string
          follow_up_notes: string | null
          id: string
          leader_id: string
          lesson_id: string
          participation_notes: string | null
          pastoral_care_notes: string | null
          questions_notes: string | null
          spiritual_notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          follow_up_notes?: string | null
          id?: string
          leader_id: string
          lesson_id: string
          participation_notes?: string | null
          pastoral_care_notes?: string | null
          questions_notes?: string | null
          spiritual_notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          follow_up_notes?: string | null
          id?: string
          leader_id?: string
          lesson_id?: string
          participation_notes?: string | null
          pastoral_care_notes?: string | null
          questions_notes?: string | null
          spiritual_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_meeting_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_content: {
        Row: {
          audio_link: string
          bible_texts: string[]
          created_at: string
          greeting: string
          icebreaker: string
          id: string
          lesson_id: string
          pdf_link: string
          practice: string
          prayer_prompt: string
          questions: string[]
          summary: string
          updated_at: string
          video_link: string
        }
        Insert: {
          audio_link?: string
          bible_texts?: string[]
          created_at?: string
          greeting?: string
          icebreaker?: string
          id?: string
          lesson_id: string
          pdf_link?: string
          practice?: string
          prayer_prompt?: string
          questions?: string[]
          summary?: string
          updated_at?: string
          video_link?: string
        }
        Update: {
          audio_link?: string
          bible_texts?: string[]
          created_at?: string
          greeting?: string
          icebreaker?: string
          id?: string
          lesson_id?: string
          pdf_link?: string
          practice?: string
          prayer_prompt?: string
          questions?: string[]
          summary?: string
          updated_at?: string
          video_link?: string
        }
        Relationships: []
      }
      lesson_responses: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          question_key: string
          response: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          question_key: string
          response?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          question_key?: string
          response?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          course_id: string
          created_at: string
          id: string
          objective: string | null
          order_num: number
          title: string
          topics: string[] | null
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          objective?: string | null
          order_num: number
          title: string
          topics?: string[] | null
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          objective?: string | null
          order_num?: number
          title?: string
          topics?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_evaluations: {
        Row: {
          admin_id: string
          created_at: string
          engagement_score: number | null
          event_id: string
          id: string
          notes: string | null
          participation_score: number | null
          understanding_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          engagement_score?: number | null
          event_id: string
          id?: string
          notes?: string | null
          participation_score?: number | null
          understanding_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          engagement_score?: number | null
          event_id?: string
          id?: string
          notes?: string | null
          participation_score?: number | null
          understanding_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_evaluations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_views: {
        Row: {
          id: string
          message_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_views_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          area: string | null
          body: string
          community: string | null
          created_at: string
          id: string
          sent_by: string | null
          title: string
          turma_id: string | null
        }
        Insert: {
          area?: string | null
          body: string
          community?: string | null
          created_at?: string
          id?: string
          sent_by?: string | null
          title: string
          turma_id?: string | null
        }
        Update: {
          area?: string | null
          body?: string
          community?: string | null
          created_at?: string
          id?: string
          sent_by?: string | null
          title?: string
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          devocional: boolean
          eventos: boolean
          id: string
          master_enabled: boolean
          mensagens: boolean
          preferred_hour: number
          streak: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          devocional?: boolean
          eventos?: boolean
          id?: string
          master_enabled?: boolean
          mensagens?: boolean
          preferred_hour?: number
          streak?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          devocional?: boolean
          eventos?: boolean
          id?: string
          master_enabled?: boolean
          mensagens?: boolean
          preferred_hour?: number
          streak?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pastoral_notes: {
        Row: {
          admin_id: string
          content: string
          created_at: string
          id: string
          is_private: boolean
          note_type: string
          user_id: string
        }
        Insert: {
          admin_id: string
          content: string
          created_at?: string
          id?: string
          is_private?: boolean
          note_type?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          content?: string
          created_at?: string
          id?: string
          is_private?: boolean
          note_type?: string
          user_id?: string
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          id: string
          option_index: number
          poll_id: string
          user_id: string
          voted_at: string
        }
        Insert: {
          id?: string
          option_index: number
          poll_id: string
          user_id: string
          voted_at?: string
        }
        Update: {
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          area: string | null
          community: string
          created_at: string
          created_by: string
          emoji: string
          ends_at: string | null
          id: string
          is_active: boolean
          options: string[]
          question: string
        }
        Insert: {
          area?: string | null
          community: string
          created_at?: string
          created_by: string
          emoji?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          options?: string[]
          question: string
        }
        Update: {
          area?: string | null
          community?: string
          created_at?: string
          created_by?: string
          emoji?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          options?: string[]
          question?: string
        }
        Relationships: []
      }
      prayer_pairs: {
        Row: {
          community: string
          created_at: string
          id: string
          user_a_confirmed: boolean
          user_a_id: string
          user_a_name: string
          user_a_testimony: string | null
          user_b_confirmed: boolean
          user_b_id: string
          user_b_name: string
          user_b_testimony: string | null
          week_start: string
        }
        Insert: {
          community: string
          created_at?: string
          id?: string
          user_a_confirmed?: boolean
          user_a_id: string
          user_a_name?: string
          user_a_testimony?: string | null
          user_b_confirmed?: boolean
          user_b_id: string
          user_b_name?: string
          user_b_testimony?: string | null
          week_start: string
        }
        Update: {
          community?: string
          created_at?: string
          id?: string
          user_a_confirmed?: boolean
          user_a_id?: string
          user_a_name?: string
          user_a_testimony?: string | null
          user_b_confirmed?: boolean
          user_b_id?: string
          user_b_name?: string
          user_b_testimony?: string | null
          week_start?: string
        }
        Relationships: []
      }
      prayer_requests: {
        Row: {
          amen_count: number
          community: string
          content: string
          created_at: string
          id: string
          is_anonymous: boolean
          status: string
          user_id: string
          user_name: string
        }
        Insert: {
          amen_count?: number
          community: string
          content: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          status?: string
          user_id: string
          user_name: string
        }
        Update: {
          amen_count?: number
          community?: string
          content?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          status?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          area: Database["public"]["Enums"]["area_name"]
          avatar_url: string | null
          birth_date: string
          community: Database["public"]["Enums"]["community_name"]
          confirmation_year: number | null
          created_at: string
          email: string | null
          father_name: string | null
          father_phone: string | null
          full_name: string
          id: string
          mother_name: string | null
          mother_phone: string | null
          phone: string
          turma_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          area: Database["public"]["Enums"]["area_name"]
          avatar_url?: string | null
          birth_date: string
          community: Database["public"]["Enums"]["community_name"]
          confirmation_year?: number | null
          created_at?: string
          email?: string | null
          father_name?: string | null
          father_phone?: string | null
          full_name: string
          id?: string
          mother_name?: string | null
          mother_phone?: string | null
          phone: string
          turma_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          area?: Database["public"]["Enums"]["area_name"]
          avatar_url?: string | null
          birth_date?: string
          community?: Database["public"]["Enums"]["community_name"]
          confirmation_year?: number | null
          created_at?: string
          email?: string | null
          father_name?: string | null
          father_phone?: string | null
          full_name?: string
          id?: string
          mother_name?: string | null
          mother_phone?: string | null
          phone?: string
          turma_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      push_activation_reminders: {
        Row: {
          created_at: string
          dismissed_at: string | null
          id: string
          sent_by: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          sent_by: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          sent_by?: string
          target_user_id?: string
        }
        Relationships: []
      }
      push_notification_log: {
        Row: {
          body: string
          created_at: string
          failed_count: number
          id: string
          sent_by: string | null
          sent_count: number
          target: string
          target_value: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string
          created_at?: string
          failed_count?: number
          id?: string
          sent_by?: string | null
          sent_count?: number
          target?: string
          target_value?: string | null
          title?: string
          type?: string
        }
        Update: {
          body?: string
          created_at?: string
          failed_count?: number
          id?: string
          sent_by?: string | null
          sent_count?: number
          target?: string
          target_value?: string | null
          title?: string
          type?: string
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
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ranking_seasons: {
        Row: {
          closed_at: string
          closed_by: string
          community: string
          course_id: string
          created_at: string
          id: string
          total_participants: number
          winners: Json
        }
        Insert: {
          closed_at?: string
          closed_by: string
          community: string
          course_id: string
          created_at?: string
          id?: string
          total_participants?: number
          winners?: Json
        }
        Update: {
          closed_at?: string
          closed_by?: string
          community?: string
          course_id?: string
          created_at?: string
          id?: string
          total_participants?: number
          winners?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ranking_seasons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      spiritual_assessments: {
        Row: {
          created_at: string
          doubt_score: number | null
          id: string
          month: number
          needs_pastor: boolean
          notes: string | null
          prayer_score: number | null
          presence_score: number | null
          struggle_score: number | null
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          doubt_score?: number | null
          id?: string
          month: number
          needs_pastor?: boolean
          notes?: string | null
          prayer_score?: number | null
          presence_score?: number | null
          struggle_score?: number | null
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          doubt_score?: number | null
          id?: string
          month?: number
          needs_pastor?: boolean
          notes?: string | null
          prayer_score?: number | null
          presence_score?: number | null
          struggle_score?: number | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      testimonies: {
        Row: {
          community: string
          content: string
          created_at: string
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          community: string
          content: string
          created_at?: string
          id?: string
          user_id: string
          user_name: string
        }
        Update: {
          community?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      turmas: {
        Row: {
          area: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          year: number
        }
        Insert: {
          area?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          year?: number
        }
        Update: {
          area?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          year?: number
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          activity_id: string
          completed_at: string
          id: string
          user_id: string
        }
        Insert: {
          activity_id: string
          completed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          completed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          admin_area: string | null
          id: string
          is_super: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          admin_area?: string | null
          id?: string
          is_super?: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          admin_area?: string | null
          id?: string
          is_super?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worship_attendance: {
        Row: {
          created_at: string
          event_type: string
          id: string
          preacher_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
          worship_date: string
          worship_time: string
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          preacher_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
          worship_date: string
          worship_time: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          preacher_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
          worship_date?: string
          worship_time?: string
        }
        Relationships: []
      }
      year_promotion_requests: {
        Row: {
          from_year: number
          id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          to_year: number
          turma_id: string | null
          user_id: string
        }
        Insert: {
          from_year?: number
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          to_year?: number
          turma_id?: string | null
          user_id: string
        }
        Update: {
          from_year?: number
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          to_year?: number
          turma_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "year_promotion_requests_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_community_area: {
        Args: { _community: Database["public"]["Enums"]["community_name"] }
        Returns: Database["public"]["Enums"]["area_name"]
      }
      get_community_ranking: {
        Args: { _community: Database["public"]["Enums"]["community_name"] }
        Returns: {
          completed_count: number
          faith_points: number
          full_name: string
          user_id: string
        }[]
      }
      get_my_area: {
        Args: never
        Returns: Database["public"]["Enums"]["area_name"]
      }
      get_my_community: {
        Args: never
        Returns: Database["public"]["Enums"]["community_name"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "user" | "admin" | "lider"
      area_name: "Área 1" | "Área 2"
      community_name:
        | "Martim Lutero"
        | "Bom Pastor"
        | "Rincão Fundo"
        | "Rincão Frente"
        | "Linha Brasil"
        | "Iriá Pira 1"
        | "Iriá Pira 2"
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
      app_role: ["user", "admin", "lider"],
      area_name: ["Área 1", "Área 2"],
      community_name: [
        "Martim Lutero",
        "Bom Pastor",
        "Rincão Fundo",
        "Rincão Frente",
        "Linha Brasil",
        "Iriá Pira 1",
        "Iriá Pira 2",
      ],
    },
  },
} as const
