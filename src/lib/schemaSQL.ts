// Auto-generated: All migration SQL concatenated for full export
// This file contains the complete database schema (structure + RLS + functions + triggers)

export const SCHEMA_SQL = `
-- =============================================
-- ESTRUTURA COMPLETA DO BANCO DE DADOS
-- Caminho Boa Nova
-- =============================================
-- Execute este arquivo ANTES do arquivo de dados.
-- Requer um projeto Supabase novo/limpo.
-- =============================================

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'lider');

CREATE TYPE public.community_name AS ENUM (
  'Martim Lutero',
  'Bom Pastor',
  'Rincão Fundo',
  'Rincão Frente',
  'Linha Brasil',
  'Iriá Pira 1',
  'Iriá Pira 2'
);

CREATE TYPE public.area_name AS ENUM ('Área 1', 'Área 2');

-- ============================================================
-- HELPER FUNCTIONS (needed before tables with RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_lesson_content_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- TABLES
-- ============================================================

-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  phone TEXT NOT NULL,
  community community_name NOT NULL,
  area area_name NOT NULL,
  father_name text DEFAULT '',
  mother_name text DEFAULT '',
  father_phone text DEFAULT '',
  mother_phone text DEFAULT '',
  address text DEFAULT '',
  turma_id uuid,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  admin_area text,
  is_super boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, role)
);

-- activities
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  order_num INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- user_progress
CREATE TABLE public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_id)
);

-- courses
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_num integer NOT NULL,
  title text NOT NULL,
  subtitle text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- lessons
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_num integer NOT NULL,
  title text NOT NULL,
  objective text,
  topics text[],
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date timestamp with time zone NOT NULL,
  location text,
  area text,
  community text,
  type text NOT NULL DEFAULT 'encontro',
  linked_lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  area text,
  community text,
  sent_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- message_reactions
CREATE TABLE public.message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- lesson_responses
CREATE TABLE public.lesson_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  question_key text NOT NULL,
  response text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id, question_key)
);

-- lesson_content
CREATE TABLE public.lesson_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id uuid NOT NULL UNIQUE,
  greeting text NOT NULL DEFAULT '',
  icebreaker text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  bible_texts text[] NOT NULL DEFAULT '{}',
  questions text[] NOT NULL DEFAULT '{}',
  practice text NOT NULL DEFAULT '',
  prayer_prompt text NOT NULL DEFAULT '',
  video_link text NOT NULL DEFAULT '',
  audio_link text NOT NULL DEFAULT '',
  pdf_link text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- devotional_content
CREATE TABLE public.devotional_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id uuid UNIQUE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  day_number integer NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT '',
  bible_text text NOT NULL DEFAULT '',
  bible_reference text NOT NULL DEFAULT '',
  reflection text NOT NULL DEFAULT '',
  prayer text NOT NULL DEFAULT '',
  practice text NOT NULL DEFAULT '',
  questions text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX devotional_content_lesson_day_unique
  ON public.devotional_content (lesson_id, day_number) WHERE lesson_id IS NOT NULL;

-- devotional_progress
CREATE TABLE public.devotional_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  devotional_id UUID NOT NULL REFERENCES public.devotional_content(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, devotional_id)
);

-- devotional_responses
CREATE TABLE public.devotional_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  devotional_id UUID NOT NULL,
  question_index INTEGER NOT NULL,
  response TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, devotional_id, question_index),
  CONSTRAINT devotional_responses_progress_fkey
    FOREIGN KEY (user_id, devotional_id)
    REFERENCES public.devotional_progress(user_id, devotional_id)
    ON DELETE CASCADE
);

-- spiritual_assessments
CREATE TABLE public.spiritual_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  prayer_score integer,
  presence_score integer,
  struggle_score integer,
  doubt_score integer,
  needs_pastor boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, month, year)
);

-- discipleship_plans
CREATE TABLE public.discipleship_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  objectives text,
  challenges text,
  recommendations text,
  next_steps text,
  pastor_notes text,
  health_status text NOT NULL DEFAULT 'atencao',
  aptidao text DEFAULT 'acompanhamento',
  is_priority boolean NOT NULL DEFAULT false,
  last_contact_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- pastoral_notes
CREATE TABLE public.pastoral_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  note_type text NOT NULL DEFAULT 'acompanhamento',
  content text NOT NULL,
  is_private boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- attendance
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'presente',
  justification text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- meeting_evaluations
CREATE TABLE public.meeting_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  participation_score integer,
  understanding_score integer,
  engagement_score integer,
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- community_chat
CREATE TABLE public.community_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community text NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- prayer_requests
CREATE TABLE public.prayer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community text NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  content text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  amen_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_oracao',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- community_settings
CREATE TABLE public.community_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community text NOT NULL UNIQUE,
  whatsapp_link text,
  verse_of_week text,
  verse_reference text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- worship_attendance
CREATE TABLE public.worship_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  worship_date DATE NOT NULL,
  worship_time TEXT NOT NULL,
  preacher_name TEXT NOT NULL,
  event_type text NOT NULL DEFAULT 'culto',
  status TEXT NOT NULL DEFAULT 'pendente',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ranking_seasons
CREATE TABLE public.ranking_seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id),
  community TEXT NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_by UUID NOT NULL,
  winners JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_participants INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ranking_seasons_unique ON public.ranking_seasons (course_id, community);

-- testimonies
CREATE TABLE public.testimonies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  community text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- community_challenges
CREATE TABLE public.community_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  emoji text NOT NULL DEFAULT '📖',
  community text,
  area text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- challenge_participants
CREATE TABLE public.challenge_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id uuid NOT NULL REFERENCES public.community_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  UNIQUE(challenge_id, user_id)
);

-- course_unlocks
CREATE TABLE public.course_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  area text NOT NULL,
  unlocked_by uuid NOT NULL,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(course_id, area)
);

-- achievement_unlocks
CREATE TABLE public.achievement_unlocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  achievement_key text NOT NULL,
  bonus_points integer NOT NULL DEFAULT 10,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

-- notification_preferences
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  devocional boolean NOT NULL DEFAULT true,
  eventos boolean NOT NULL DEFAULT true,
  streak boolean NOT NULL DEFAULT true,
  mensagens boolean NOT NULL DEFAULT true,
  master_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- turmas
CREATE TABLE public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area text,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- area_pastors
CREATE TABLE public.area_pastors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  pastor_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- leader_meeting_notes
CREATE TABLE public.leader_meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL,
  participation_notes text DEFAULT '',
  spiritual_notes text DEFAULT '',
  questions_notes text DEFAULT '',
  pastoral_care_notes text DEFAULT '',
  follow_up_notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, leader_id)
);

-- Add FK from profiles to turmas
ALTER TABLE public.profiles ADD CONSTRAINT profiles_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id);

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devotional_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devotional_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devotional_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spiritual_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipleship_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pastoral_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worship_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area_pastors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leader_meeting_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_community_area(_community community_name)
RETURNS area_name LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _community IN ('Rincão Frente', 'Rincão Fundo', 'Bom Pastor', 'Iriá Pira 1') THEN 'Área 1'::area_name
    ELSE 'Área 2'::area_name
  END
$$;

CREATE OR REPLACE FUNCTION public.get_my_community()
RETURNS community_name LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT community FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_area()
RETURNS area_name LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('admin', 'lider') AND is_super = true
      ) THEN (SELECT area FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      ELSE COALESCE(
        (SELECT admin_area::area_name FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'lider') AND admin_area IS NOT NULL LIMIT 1),
        (SELECT area FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      )
    END
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'lider') AND is_super = true
  )
$$;

-- Ranking function
CREATE OR REPLACE FUNCTION public.get_community_ranking(_community community_name)
RETURNS TABLE(user_id uuid, full_name text, completed_count bigint, faith_points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lesson_pts integer;
  _dev_pts integer;
  _dev_wk_pts integer;
  _dev_recovery_pts integer;
  _att_pts integer;
  _worship_pts integer;
  _course_bonus integer;
  _challenge_pts integer;
BEGIN
  SELECT
    COALESCE(MAX(CASE WHEN key = 'lesson_points'              THEN value END), 20),
    COALESCE(MAX(CASE WHEN key = 'devotional_points'          THEN value END), 5),
    COALESCE(MAX(CASE WHEN key = 'devotional_weekend_points'  THEN value END), 2),
    COALESCE(MAX(CASE WHEN key = 'devotional_recovery_points' THEN value END), 2),
    COALESCE(MAX(CASE WHEN key = 'attendance_points'          THEN value END), 10),
    COALESCE(MAX(CASE WHEN key = 'worship_points'             THEN value END), 5),
    COALESCE(MAX(CASE WHEN key = 'course_completion_bonus'    THEN value END), 100),
    COALESCE(MAX(CASE WHEN key = 'challenge_points'           THEN value END), 15)
  INTO _lesson_pts, _dev_pts, _dev_wk_pts, _dev_recovery_pts, _att_pts, _worship_pts, _course_bonus, _challenge_pts
  FROM public.game_config;

  RETURN QUERY
  WITH scoped_profiles AS (
    SELECT p.user_id, p.full_name, p.area
    FROM public.profiles p
    WHERE p.community = _community
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = p.user_id
          AND ur.role IN ('admin', 'lider')
      )
  ),
  lesson_points AS (
    SELECT lr.user_id, COUNT(DISTINCT lr.lesson_id) * _lesson_pts AS pts
    FROM public.lesson_responses lr
    JOIN scoped_profiles sp ON sp.user_id = lr.user_id
    GROUP BY lr.user_id
  ),
  devotional_pts AS (
    SELECT
      dp.user_id,
      SUM(
        COALESCE(
          dp.awarded_points,
          CASE
            WHEN COALESCE(dp.is_recovery, false) THEN _dev_recovery_pts
            WHEN EXTRACT(DOW FROM dp.completed_at AT TIME ZONE 'America/Sao_Paulo') IN (0, 6) THEN _dev_wk_pts
            ELSE _dev_pts
          END
        )
      ) AS pts
    FROM public.devotional_progress dp
    JOIN scoped_profiles sp ON sp.user_id = dp.user_id
    GROUP BY dp.user_id
  ),
  attendance_pts AS (
    SELECT
      a.user_id,
      SUM(
        CASE
          WHEN COALESCE(cet.gives_points, false) THEN COALESCE(cet.points, _att_pts)
          ELSE _att_pts
        END
      ) AS pts
    FROM public.attendance a
    JOIN scoped_profiles sp ON sp.user_id = a.user_id
    JOIN public.events e ON e.id = a.event_id
    LEFT JOIN LATERAL (
      SELECT cet.gives_points, cet.points
      FROM public.custom_event_types cet
      WHERE cet.value = e.type
        AND (cet.area IS NULL OR cet.area = sp.area)
      ORDER BY CASE WHEN cet.area = sp.area THEN 0 ELSE 1 END
      LIMIT 1
    ) cet ON true
    WHERE a.status = 'presente'
    GROUP BY a.user_id
  ),
  worship_pts AS (
    SELECT wa.user_id, COUNT(*) * _worship_pts AS pts
    FROM public.worship_attendance wa
    JOIN scoped_profiles sp ON sp.user_id = wa.user_id
    WHERE wa.status = 'aprovado'
    GROUP BY wa.user_id
  ),
  activity_pts AS (
    SELECT up.user_id, COALESCE(SUM(act.points), 0) AS pts, COUNT(up.id) AS cnt
    FROM public.user_progress up
    JOIN public.activities act ON act.id = up.activity_id
    JOIN scoped_profiles sp ON sp.user_id = up.user_id
    GROUP BY up.user_id
  ),
  challenge_pts AS (
    SELECT cp.user_id, COUNT(*) * _challenge_pts AS pts
    FROM public.challenge_participants cp
    JOIN scoped_profiles sp ON sp.user_id = cp.user_id
    WHERE cp.completed = true
    GROUP BY cp.user_id
  ),
  course_bonus AS (
    SELECT sp.user_id, COUNT(DISTINCT c.id) * _course_bonus AS pts
    FROM scoped_profiles sp
    JOIN public.courses c ON true
    JOIN public.lessons l ON l.course_id = c.id
    LEFT JOIN public.lesson_responses lr ON lr.lesson_id = l.id AND lr.user_id = sp.user_id
    GROUP BY sp.user_id, c.id, (SELECT COUNT(*) FROM public.lessons WHERE course_id = c.id)
    HAVING COUNT(DISTINCT lr.lesson_id) = (SELECT COUNT(*) FROM public.lessons WHERE course_id = c.id)
  ),
  course_bonus_agg AS (
    SELECT cb.user_id, SUM(cb.pts) AS pts
    FROM course_bonus cb
    GROUP BY cb.user_id
  ),
  achievement_pts AS (
    SELECT au.user_id, COALESCE(SUM(au.bonus_points), 0) AS pts
    FROM public.achievement_unlocks au
    JOIN scoped_profiles sp ON sp.user_id = au.user_id
    GROUP BY au.user_id
  )
  SELECT sp.user_id, sp.full_name,
    COALESCE(ap.cnt, 0)::bigint AS completed_count,
    (COALESCE(lp.pts, 0) + COALESCE(dp.pts, 0) + COALESCE(atp.pts, 0) +
     COALESCE(ap.pts, 0) + COALESCE(cb.pts, 0) + COALESCE(wp.pts, 0) +
     COALESCE(achp.pts, 0) + COALESCE(chp.pts, 0))::bigint AS faith_points
  FROM scoped_profiles sp
  LEFT JOIN lesson_points lp ON lp.user_id = sp.user_id
  LEFT JOIN devotional_pts dp ON dp.user_id = sp.user_id
  LEFT JOIN attendance_pts atp ON atp.user_id = sp.user_id
  LEFT JOIN activity_pts ap ON ap.user_id = sp.user_id
  LEFT JOIN course_bonus_agg cb ON cb.user_id = sp.user_id
  LEFT JOIN worship_pts wp ON wp.user_id = sp.user_id
  LEFT JOIN achievement_pts achp ON achp.user_id = sp.user_id
  LEFT JOIN challenge_pts chp ON chp.user_id = sp.user_id
  ORDER BY faith_points DESC, completed_count DESC;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discipleship_plans_updated_at BEFORE UPDATE ON public.discipleship_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lesson_responses_updated_at BEFORE UPDATE ON public.lesson_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lesson_content_timestamp BEFORE UPDATE ON public.lesson_content
  FOR EACH ROW EXECUTE FUNCTION public.update_lesson_content_updated_at();

CREATE TRIGGER update_devotional_content_updated_at BEFORE UPDATE ON public.devotional_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_devotional_responses_updated_at BEFORE UPDATE ON public.devotional_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meeting_evaluations_updated_at BEFORE UPDATE ON public.meeting_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leader_meeting_notes_updated_at BEFORE UPDATE ON public.leader_meeting_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_area_pastors_updated_at BEFORE UPDATE ON public.area_pastors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile from auth.users metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  community_val community_name;
  area_val area_name;
BEGIN
  IF NEW.raw_user_meta_data IS NOT NULL
    AND NEW.raw_user_meta_data->>'full_name' IS NOT NULL
    AND NEW.raw_user_meta_data->>'community' IS NOT NULL
  THEN
    BEGIN
      community_val := (NEW.raw_user_meta_data->>'community')::community_name;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NEW;
    END;
    area_val := CASE
      WHEN community_val IN ('Rincão Frente', 'Rincão Fundo', 'Bom Pastor', 'Iriá Pira 1') THEN 'Área 1'::area_name
      ELSE 'Área 2'::area_name
    END;
    INSERT INTO public.profiles (user_id, full_name, birth_date, phone, community, area)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', (NEW.raw_user_meta_data->>'birth_date')::date, NEW.raw_user_meta_data->>'phone', community_val, area_val)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- NOTE: The trigger on auth.users must be created manually in Supabase:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view profiles in their community" ON public.profiles FOR SELECT USING (community = get_my_community());
CREATE POLICY "Admins can view profiles in their area" ON public.profiles FOR SELECT USING ((auth.uid() = user_id) OR (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR area = get_my_area())));
CREATE POLICY "Admins can update profiles in their area" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR area = get_my_area())) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Liders can view profiles in their area" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR area = get_my_area()));
CREATE POLICY "Liders can update profiles in their area" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR area = get_my_area())) WITH CHECK (has_role(auth.uid(), 'lider'));

-- user_roles
CREATE POLICY "Users can view their own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Liders can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'lider'));

-- activities
CREATE POLICY "Activities viewable by authenticated users" ON public.activities FOR SELECT TO authenticated USING (true);

-- user_progress
CREATE POLICY "Users can view own progress" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view area participants progress" ON public.user_progress FOR SELECT USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = user_progress.user_id AND p.area = get_my_area())));
CREATE POLICY "Liders can view area participants progress" ON public.user_progress FOR SELECT USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = user_progress.user_id AND p.area = get_my_area())));

-- courses
CREATE POLICY "Courses viewable by authenticated users" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage courses" ON public.courses FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- lessons
CREATE POLICY "Lessons viewable by authenticated users" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage lessons" ON public.lessons FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- events
CREATE POLICY "Events viewable by authenticated users" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage events" ON public.events FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- messages
CREATE POLICY "Users can view messages for their area or community" ON public.messages FOR SELECT TO authenticated USING (area IS NULL OR area = get_my_area()::text OR community = get_my_community()::text);
CREATE POLICY "Admins can manage messages" ON public.messages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- message_reactions
CREATE POLICY "Users can view message reactions" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Users can add reactions" ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own reactions" ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

-- lesson_responses
CREATE POLICY "Users can manage their own lesson responses" ON public.lesson_responses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view lesson responses in their area" ON public.lesson_responses FOR SELECT USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = lesson_responses.user_id AND p.area = get_my_area())));
CREATE POLICY "Liders can view lesson responses in their area" ON public.lesson_responses FOR SELECT USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = lesson_responses.user_id AND p.area = get_my_area())));

-- lesson_content
CREATE POLICY "Admins can manage lesson content" ON public.lesson_content FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view lesson content" ON public.lesson_content FOR SELECT USING (auth.uid() IS NOT NULL);

-- devotional_content
CREATE POLICY "Admins can manage devotional content" ON public.devotional_content FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view devotional content" ON public.devotional_content FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- devotional_progress
CREATE POLICY "Users can view their own devotional progress" ON public.devotional_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own devotional progress" ON public.devotional_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own devotional progress" ON public.devotional_progress FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all devotional progress" ON public.devotional_progress FOR SELECT USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = devotional_progress.user_id AND p.area = get_my_area())));
CREATE POLICY "Liders can view all devotional progress" ON public.devotional_progress FOR SELECT USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = devotional_progress.user_id AND p.area = get_my_area())));

-- devotional_responses
CREATE POLICY "Users can manage their own devotional responses" ON public.devotional_responses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view devotional responses in their area" ON public.devotional_responses FOR SELECT USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = devotional_responses.user_id AND p.area = get_my_area())));
CREATE POLICY "Liders can view devotional responses in their area" ON public.devotional_responses FOR SELECT USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = devotional_responses.user_id AND p.area = get_my_area())));

-- spiritual_assessments
CREATE POLICY "Users can manage their own assessments" ON public.spiritual_assessments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view assessments in their area" ON public.spiritual_assessments FOR SELECT USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = spiritual_assessments.user_id AND p.area = get_my_area())));
CREATE POLICY "Liders can view assessments in their area" ON public.spiritual_assessments FOR SELECT USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = spiritual_assessments.user_id AND p.area = get_my_area())));

-- discipleship_plans
CREATE POLICY "Users can view their own plan" ON public.discipleship_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage plans in their area" ON public.discipleship_plans FOR ALL USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = discipleship_plans.user_id AND p.area = get_my_area()))) WITH CHECK (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = discipleship_plans.user_id AND p.area = get_my_area())));
CREATE POLICY "Liders can manage plans in their area" ON public.discipleship_plans FOR ALL USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = discipleship_plans.user_id AND p.area = get_my_area()))) WITH CHECK (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = discipleship_plans.user_id AND p.area = get_my_area())));

-- pastoral_notes
CREATE POLICY "Admins can manage pastoral notes in their area" ON public.pastoral_notes FOR ALL USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = pastoral_notes.user_id AND p.area = get_my_area()))) WITH CHECK (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = pastoral_notes.user_id AND p.area = get_my_area())));
CREATE POLICY "Liders can manage pastoral notes in their area" ON public.pastoral_notes FOR ALL USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = pastoral_notes.user_id AND p.area = get_my_area()))) WITH CHECK (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = pastoral_notes.user_id AND p.area = get_my_area())));

-- attendance
CREATE POLICY "Users can view their own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own attendance" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own attendance" ON public.attendance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage attendance in their area" ON public.attendance FOR ALL USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = attendance.user_id AND p.area = get_my_area()))) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Liders can manage attendance in their area" ON public.attendance FOR ALL USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = attendance.user_id AND p.area = get_my_area()))) WITH CHECK (has_role(auth.uid(), 'lider'));

-- meeting_evaluations
CREATE POLICY "Admins can manage evaluations in their area" ON public.meeting_evaluations FOR ALL USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = meeting_evaluations.user_id AND p.area = get_my_area()))) WITH CHECK (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = meeting_evaluations.user_id AND p.area = get_my_area())));
CREATE POLICY "Liders can manage evaluations in their area" ON public.meeting_evaluations FOR ALL USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = meeting_evaluations.user_id AND p.area = get_my_area()))) WITH CHECK (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = meeting_evaluations.user_id AND p.area = get_my_area())));

-- community_chat
CREATE POLICY "Users can view chat from their community" ON public.community_chat FOR SELECT USING (community = (get_my_community())::text);
CREATE POLICY "Users can insert chat messages in their community" ON public.community_chat FOR INSERT WITH CHECK (auth.uid() = user_id AND community = (get_my_community())::text);
CREATE POLICY "Admins can delete chat messages" ON public.community_chat FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete their own chat messages" ON public.community_chat FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Liders can delete chat messages in their area" ON public.community_chat FOR DELETE USING (has_role(auth.uid(), 'lider') AND community = (get_my_community())::text);

-- prayer_requests
CREATE POLICY "Users can view prayer requests from their community" ON public.prayer_requests FOR SELECT USING (community = (get_my_community())::text);
CREATE POLICY "Users can insert prayer requests in their community" ON public.prayer_requests FOR INSERT WITH CHECK (auth.uid() = user_id AND community = (get_my_community())::text);
CREATE POLICY "Users can update amen count" ON public.prayer_requests FOR UPDATE USING (community = (get_my_community())::text) WITH CHECK (community = (get_my_community())::text);
CREATE POLICY "Admins can delete prayer requests" ON public.prayer_requests FOR DELETE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete their own prayer requests" ON public.prayer_requests FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Liders can delete prayer requests in their area" ON public.prayer_requests FOR DELETE USING (has_role(auth.uid(), 'lider') AND community = (get_my_community())::text);

-- community_settings
CREATE POLICY "Anyone authenticated can view community settings" ON public.community_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage community settings" ON public.community_settings FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- worship_attendance
CREATE POLICY "Users can insert own worship attendance" ON public.worship_attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own worship attendance" ON public.worship_attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view worship attendance in area" ON public.worship_attendance FOR SELECT USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())));
CREATE POLICY "Admins can update worship attendance in area" ON public.worship_attendance FOR UPDATE USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())));
CREATE POLICY "Admins can delete worship attendance in area" ON public.worship_attendance FOR DELETE USING (has_role(auth.uid(), 'admin') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())));
CREATE POLICY "Liders can view worship attendance in area" ON public.worship_attendance FOR SELECT USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())));
CREATE POLICY "Liders can update worship attendance in area" ON public.worship_attendance FOR UPDATE USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())));
CREATE POLICY "Liders can delete worship attendance in area" ON public.worship_attendance FOR DELETE USING (has_role(auth.uid(), 'lider') AND (is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = worship_attendance.user_id AND p.area = get_my_area())));

-- ranking_seasons
CREATE POLICY "Admins can manage ranking seasons" ON public.ranking_seasons FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view ranking seasons for their community" ON public.ranking_seasons FOR SELECT USING (community = (get_my_community())::text);

-- testimonies
CREATE POLICY "Users can view testimonies from their community" ON public.testimonies FOR SELECT USING (community = (get_my_community())::text);
CREATE POLICY "Users can insert their own testimonies" ON public.testimonies FOR INSERT WITH CHECK (auth.uid() = user_id AND community = (get_my_community())::text);
CREATE POLICY "Users can delete their own testimonies" ON public.testimonies FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete testimonies" ON public.testimonies FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- community_challenges
CREATE POLICY "Authenticated users can view challenges" ON public.community_challenges FOR SELECT USING (true);
CREATE POLICY "Admins can manage challenges" ON public.community_challenges FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- challenge_participants
CREATE POLICY "Users can view challenge participants" ON public.challenge_participants FOR SELECT USING (true);
CREATE POLICY "Users can join challenges" ON public.challenge_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own participation" ON public.challenge_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave challenges" ON public.challenge_participants FOR DELETE USING (auth.uid() = user_id);

-- course_unlocks
CREATE POLICY "Admins can manage course unlocks" ON public.course_unlocks FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Liders can manage course unlocks in their area" ON public.course_unlocks FOR ALL USING (has_role(auth.uid(), 'lider') AND area = (get_my_area())::text) WITH CHECK (has_role(auth.uid(), 'lider') AND area = (get_my_area())::text);
CREATE POLICY "Authenticated users can view course unlocks" ON public.course_unlocks FOR SELECT USING (auth.uid() IS NOT NULL);

-- achievement_unlocks
CREATE POLICY "Users can view own achievement unlocks" ON public.achievement_unlocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievement unlocks" ON public.achievement_unlocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all achievement unlocks" ON public.achievement_unlocks FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Liders can view achievement unlocks in their area" ON public.achievement_unlocks FOR SELECT USING (has_role(auth.uid(), 'lider') AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = achievement_unlocks.user_id AND p.area = get_my_area()));

-- notification_preferences
CREATE POLICY "Users can view their own notification preferences" ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own notification preferences" ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notification preferences" ON public.notification_preferences FOR UPDATE USING (auth.uid() = user_id);

-- turmas
CREATE POLICY "Admins can manage turmas" ON public.turmas FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can view turmas" ON public.turmas FOR SELECT USING (auth.uid() IS NOT NULL);

-- area_pastors
CREATE POLICY "Authenticated users can view area pastors" ON public.area_pastors FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage area pastors" ON public.area_pastors FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- leader_meeting_notes
CREATE POLICY "Leaders can manage their own notes" ON public.leader_meeting_notes FOR ALL USING (auth.uid() = leader_id) WITH CHECK (auth.uid() = leader_id);
CREATE POLICY "Admins can view all leader notes" ON public.leader_meeting_notes FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prayer_requests;
`;
