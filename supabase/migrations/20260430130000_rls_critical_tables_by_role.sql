-- =============================================================================
-- SEGURANÇA: RLS detalhado por role nas tabelas críticas
--
-- Roles:
--   user  → Discípulo (acessa apenas seus próprios dados e da sua turma/comunidade)
--   lider → Líder (acessa dados da sua turma e área)
--   admin → Administrador de área (acessa todos da área)
--   super → is_super = true (acessa tudo)
--
-- Este arquivo REFORÇA políticas existentes e ADICIONA as que estavam faltando,
-- sem remover o que já funciona corretamente.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: função para verificar se um user_id pertence à turma gerenciada pelo lider
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_in_my_turma(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.turmas t ON t.id = p.turma_id
    WHERE p.user_id = _target_user_id
      AND (
        t.lider_id = auth.uid()
        OR t.created_by = auth.uid()
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_in_my_turma(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_in_my_turma(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: função para verificar se um user_id pertence à área do admin/lider
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_in_my_area(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = _target_user_id
      AND (
        is_super_admin(auth.uid())
        OR p.area = get_my_area()
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_in_my_area(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_in_my_area(uuid) TO authenticated;

-- =============================================================================
-- TABELA: user_roles — controle de promoção/rebaixamento de roles
-- Garante que apenas admins (e super admins) gerenciam roles.
-- Líderes NÃO podem alterar roles de ninguém.
-- =============================================================================
-- Remover políticas de escrita genéricas se existirem
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- SELECT: usuário vê só o próprio (já existe); admin vê todos na área
-- INSERT/UPDATE/DELETE: apenas admin de área (ou super admin)
CREATE POLICY "Admins can insert user roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Admins can update user roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Admins can delete user roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_super_admin(auth.uid())
);

-- =============================================================================
-- TABELA: profiles — Discípulos veem só o próprio; Líderes veem sua turma;
-- Admins veem a sua área; Super admins veem tudo.
-- =============================================================================
-- A política "Admins can view all profiles" existente não distingue área.
-- Substituir por versão com escopo de área.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Liders can view profiles in their area" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their area" ON public.profiles;

CREATE POLICY "Admins can view profiles in their area"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND (
    is_super_admin(auth.uid())
    OR area = get_my_area()
  )
);

CREATE POLICY "Liders can view profiles in their turma or area"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'lider'::app_role)
  AND (
    is_super_admin(auth.uid())
    OR area = get_my_area()
    OR is_in_my_turma(user_id)
  )
);

-- =============================================================================
-- TABELA: ranking_seasons — apenas admins gerenciam temporadas
-- =============================================================================
-- Verificar se há política de escrita para usuários comuns
DROP POLICY IF EXISTS "Users can view ranking seasons" ON public.ranking_seasons;
DROP POLICY IF EXISTS "Anyone can view ranking seasons" ON public.ranking_seasons;

CREATE POLICY "Authenticated users can view ranking seasons"
ON public.ranking_seasons FOR SELECT
TO authenticated
USING (true);

-- Se não existir política de INSERT/UPDATE/DELETE, adicionar
DROP POLICY IF EXISTS "Admins can manage ranking seasons" ON public.ranking_seasons;

CREATE POLICY "Admins can manage ranking seasons"
ON public.ranking_seasons FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- =============================================================================
-- TABELA: achievement_definitions — apenas admins criam/editam conquistas
-- Discípulos e líderes apenas leem.
-- =============================================================================
DROP POLICY IF EXISTS "Everyone can view achievement definitions" ON public.achievement_definitions;
DROP POLICY IF EXISTS "Authenticated can read achievement definitions" ON public.achievement_definitions;

CREATE POLICY "Authenticated users can read achievement definitions"
ON public.achievement_definitions FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage achievement definitions" ON public.achievement_definitions;

CREATE POLICY "Admins can manage achievement definitions"
ON public.achievement_definitions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- =============================================================================
-- TABELA: push_automation_config — apenas admins configuram automação
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage push automation" ON public.push_automation_config;
DROP POLICY IF EXISTS "Authenticated can view push automation" ON public.push_automation_config;

CREATE POLICY "Admins can manage push automation config"
ON public.push_automation_config FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- =============================================================================
-- TABELA: push_scheduled — apenas admins visualizam/gerenciam notificações agendadas
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage push scheduled" ON public.push_scheduled;

CREATE POLICY "Admins can manage push scheduled"
ON public.push_scheduled FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- =============================================================================
-- TABELA: system_update_log — apenas super admins leem/escrevem
-- =============================================================================
DROP POLICY IF EXISTS "Super admins can view system update log" ON public.system_update_log;
DROP POLICY IF EXISTS "Super admins can manage system update log" ON public.system_update_log;

CREATE POLICY "Super admins can manage system update log"
ON public.system_update_log FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- =============================================================================
-- TABELA: push_notification_log — usuários veem só as próprias notificações;
-- admins veem todas da área.
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.push_notification_log;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.push_notification_log;
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.push_notification_log;

CREATE POLICY "Users can view own push notification log"
ON public.push_notification_log FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Admins can manage push notification log"
ON public.push_notification_log FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- =============================================================================
-- TABELA: push_activation_reminders — usuários veem só os próprios
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own reminders" ON public.push_activation_reminders;
DROP POLICY IF EXISTS "Admins can manage reminders" ON public.push_activation_reminders;

CREATE POLICY "Users can view own activation reminders"
ON public.push_activation_reminders FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage activation reminders"
ON public.push_activation_reminders FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- =============================================================================
-- TABELA: message_views — usuários registram/veem suas próprias visualizações
-- =============================================================================
DROP POLICY IF EXISTS "Users can manage own message views" ON public.message_views;

CREATE POLICY "Users can insert own message views"
ON public.message_views FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own message views"
ON public.message_views FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role));

-- =============================================================================
-- TABELA: worship_attendance — Discípulos registram a si mesmos;
-- Líderes registram membros da turma; Admins gerenciam todos na área.
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage worship attendance" ON public.worship_attendance;
DROP POLICY IF EXISTS "Liders can manage worship attendance" ON public.worship_attendance;
DROP POLICY IF EXISTS "Users can view own worship attendance" ON public.worship_attendance;

CREATE POLICY "Users can view own worship attendance"
ON public.worship_attendance FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'lider'::app_role) AND is_in_my_turma(user_id))
);

CREATE POLICY "Users can insert own worship attendance"
ON public.worship_attendance FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and liders can manage worship attendance"
ON public.worship_attendance FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'lider'::app_role) AND is_in_my_turma(user_id))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
);

-- =============================================================================
-- TABELA: testimonies — usuários postam/veem; moderação por admin/lider
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can view testimonies" ON public.testimonies;
DROP POLICY IF EXISTS "Users can insert testimonies" ON public.testimonies;

CREATE POLICY "Users can view testimonies in their community"
ON public.testimonies FOR SELECT
TO authenticated
USING (
  community = get_my_community()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
);

CREATE POLICY "Users can insert own testimonies"
ON public.testimonies FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND community = get_my_community());

CREATE POLICY "Users can update own testimonies"
ON public.testimonies FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own testimonies"
ON public.testimonies FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
);

-- =============================================================================
-- TABELA: course_unlocks — admin libera cursos; usuário vê os seus
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage course unlocks" ON public.course_unlocks;
DROP POLICY IF EXISTS "Users can view own course unlocks" ON public.course_unlocks;

CREATE POLICY "Users can view own course unlocks"
ON public.course_unlocks FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR community = (get_my_community())::text
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
);

CREATE POLICY "Admins can manage course unlocks"
ON public.course_unlocks FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- =============================================================================
-- TABELA: year_promotion_requests — alunos criam; admins/líderes aprovam
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own promotion requests" ON public.year_promotion_requests;
DROP POLICY IF EXISTS "Admins can manage promotion requests" ON public.year_promotion_requests;

CREATE POLICY "Users can view own promotion requests"
ON public.year_promotion_requests FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'lider'::app_role) AND is_in_my_turma(user_id))
);

CREATE POLICY "Users can insert own promotion requests"
ON public.year_promotion_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and liders can update promotion requests"
ON public.year_promotion_requests FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
);

-- =============================================================================
-- TABELA: activity_removal_log — apenas admins/líderes leem; sem escrita direta
-- =============================================================================
DROP POLICY IF EXISTS "Admins can view activity removal log" ON public.activity_removal_log;
DROP POLICY IF EXISTS "Liders can view activity removal log" ON public.activity_removal_log;

CREATE POLICY "Admins and liders can view activity removal log"
ON public.activity_removal_log FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
);

CREATE POLICY "Admins and liders can insert activity removal log"
ON public.activity_removal_log FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
);

-- =============================================================================
-- TABELA: meeting_evaluations — usuários avaliam seus encontros
-- =============================================================================
DROP POLICY IF EXISTS "Users can manage own meeting evaluations" ON public.meeting_evaluations;
DROP POLICY IF EXISTS "Admins can view meeting evaluations" ON public.meeting_evaluations;

CREATE POLICY "Users can insert own meeting evaluations"
ON public.meeting_evaluations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own meeting evaluations"
ON public.meeting_evaluations FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
);

-- =============================================================================
-- TABELA: leader_meeting_notes — apenas líderes e admins
-- =============================================================================
DROP POLICY IF EXISTS "Leaders can manage own meeting notes" ON public.leader_meeting_notes;
DROP POLICY IF EXISTS "Admins can view leader meeting notes" ON public.leader_meeting_notes;

CREATE POLICY "Leaders can manage own meeting notes"
ON public.leader_meeting_notes FOR ALL
TO authenticated
USING (
  lider_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  lider_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- =============================================================================
-- TABELA: leader_guide — líderes leem guias da sua turma; admins gerenciam
-- =============================================================================
DROP POLICY IF EXISTS "Authenticated can view leader guide" ON public.leader_guide;
DROP POLICY IF EXISTS "Admins can manage leader guide" ON public.leader_guide;

CREATE POLICY "Liders and admins can view leader guide"
ON public.leader_guide FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'lider'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can manage leader guide"
ON public.leader_guide FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- =============================================================================
-- TABELA: area_pastors — apenas super admins gerenciam
-- =============================================================================
DROP POLICY IF EXISTS "Super admins can manage area pastors" ON public.area_pastors;
DROP POLICY IF EXISTS "Admins can view area pastors" ON public.area_pastors;

CREATE POLICY "Admins and liders can view area pastors"
ON public.area_pastors FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Super admins can manage area pastors"
ON public.area_pastors FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- =============================================================================
-- TABELA: prayer_pairs — usuários veem seu par; admins gerenciam
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own prayer pairs" ON public.prayer_pairs;
DROP POLICY IF EXISTS "Admins can manage prayer pairs" ON public.prayer_pairs;

CREATE POLICY "Users can view own prayer pairs"
ON public.prayer_pairs FOR SELECT
TO authenticated
USING (
  user_id_1 = auth.uid()
  OR user_id_2 = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
);

CREATE POLICY "Admins and liders can manage prayer pairs"
ON public.prayer_pairs FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'lider'::app_role)
);
