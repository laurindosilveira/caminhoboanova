import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isAuthorizedSystemAdmin } from "@/lib/systemAdminAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SCHEMA_SQL } from "@/lib/schemaSQL";

type AdminExportMode = "schema" | "data" | "all";
type AuditExportType = "personal_json" | "admin_schema" | "admin_data" | "admin_full";
type PrivacyRequestType = "data_deletion" | "data_correction" | "consent_review" | "other";
type GenericRowsResult = { data: Record<string, unknown>[] | null; error: { message: string } | null };
type StorageListItem = {
  name: string;
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_accessed_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

const MIGRATION_TABLES = [
  "courses",
  "activities",
  "turmas",
  "community_settings",
  "area_pastors",
  "community_challenges",
  "lessons",
  "course_unlocks",
  "ranking_seasons",
  "lesson_content",
  "devotional_content",
  "events",
  "leader_meeting_notes",
  "messages",
  "profiles",
  "user_roles",
  "user_progress",
  "lesson_responses",
  "devotional_progress",
  "devotional_responses",
  "attendance",
  "worship_attendance",
  "achievement_unlocks",
  "challenge_participants",
  "meeting_evaluations",
  "message_reactions",
  "discipleship_plans",
  "pastoral_notes",
  "spiritual_assessments",
  "notification_preferences",
  "community_chat",
  "prayer_requests",
  "testimonies",
  "user_devotional_overrides",
  "user_lesson_overrides",
];

const MIGRATION_BUCKETS = ["avatars", "challenge-files", "chat-files", "event-photos"];

const MANUAL_MIGRATION_ITEMS = [
  "Exportar usuarios do Supabase Auth pelo painel/CLI. Senhas nao sao exportadas pelo app.",
  "Recriar secrets: SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e credenciais WhatsApp.",
  "Publicar novamente as Edge Functions no novo projeto.",
  "Recriar cron jobs/agendamentos do Supabase.",
  "Copiar arquivos do Storage separadamente quando o manifesto indicar que existem arquivos.",
  "Conferir redirects, URLs publicas, dominio e configuracoes de Auth no novo projeto.",
];

function escapeSQL(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "'{}'";
    return `ARRAY[${value.map((item) => `'${String(item).replace(/'/g, "''")}'`).join(", ")}]`;
  }
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildInserts(table: string, rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return `-- No data for ${table}\n`;

  const columns = Object.keys(rows[0]);
  const values = rows.map((row) => {
    const rowValues = columns.map((column) => escapeSQL(row[column]));
    return `(${rowValues.join(", ")})`;
  });

  return `-- ${table} (${rows.length} rows)\nINSERT INTO public.${table} (${columns.join(", ")}) VALUES\n${values.join(",\n")}\nON CONFLICT DO NOTHING;\n\n`;
}

function unwrapQuery<T>(label: string, result: { data: T[] | null; error: { message: string } | null }) {
  if (result.error) throw new Error(`Falha ao carregar ${label}: ${result.error.message}`);
  return result.data ?? [];
}

export default function ExportData() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submittingPrivacyRequest, setSubmittingPrivacyRequest] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [privacyRequestType, setPrivacyRequestType] = useState<PrivacyRequestType>("data_deletion");
  const [privacyRequestDetails, setPrivacyRequestDetails] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function checkAccess() {
      const allowed = await isAuthorizedSystemAdmin();
      if (isMounted) {
        setIsSystemAdmin(allowed);
        setCheckingAccess(false);
      }
    }

    checkAccess();
    return () => {
      isMounted = false;
    };
  }, []);

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function buildHeader(type: string) {
    return `-- =============================================\n-- ${type} - Caminho Boa Nova\n-- Gerado em: ${new Date().toISOString()}\n-- =============================================\n\n`;
  }

  async function auditExport(exportType: AuditExportType, scope: "self" | "system", statusValue: "started" | "completed" | "failed", metadata: Record<string, unknown> = {}) {
    await supabase.from("data_export_audit" as never).insert({
      export_type: exportType,
      scope,
      status: statusValue,
      metadata,
    } as never);
  }

  async function fetchAllData() {
    const [block1, block2, block3, block4] = await Promise.all([
      Promise.all([
        supabase.from("courses").select("*").order("order_num"),
        supabase.from("lessons").select("*").order("course_id, order_num"),
        supabase.from("lesson_content").select("*"),
        supabase.from("devotional_content").select("*").order("lesson_id, day_number"),
        supabase.from("activities").select("*").order("order_num"),
        supabase.from("turmas").select("*"),
        supabase.from("events").select("*").order("event_date"),
        supabase.from("community_settings").select("*"),
        supabase.from("community_challenges").select("*"),
        supabase.from("course_unlocks").select("*"),
      ]),
      Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
        supabase.from("user_progress").select("*"),
        supabase.from("lesson_responses").select("*"),
        supabase.from("devotional_progress").select("*"),
        supabase.from("devotional_responses").select("*"),
        supabase.from("attendance").select("*"),
        supabase.from("worship_attendance").select("*"),
        supabase.from("achievement_unlocks").select("*"),
      ]),
      Promise.all([
        supabase.from("discipleship_plans").select("*"),
        supabase.from("pastoral_notes").select("*"),
        supabase.from("spiritual_assessments").select("*"),
        supabase.from("meeting_evaluations").select("*"),
        supabase.from("leader_meeting_notes").select("*"),
        supabase.from("messages").select("*"),
        supabase.from("message_reactions").select("*"),
        supabase.from("area_pastors").select("*"),
        supabase.from("ranking_seasons").select("*"),
        supabase.from("challenge_participants").select("*"),
        supabase.from("notification_preferences").select("*"),
        supabase.from("community_chat").select("*"),
        supabase.from("prayer_requests").select("*"),
        supabase.from("testimonies").select("*"),
      ]),
      Promise.all([
        supabase.from("user_devotional_overrides" as never).select("*"),
        supabase.from("user_lesson_overrides" as never).select("*"),
      ]),
    ]);

    const sections = [
      ["courses", unwrapQuery("courses", block1[0])],
      ["activities", unwrapQuery("activities", block1[4])],
      ["turmas", unwrapQuery("turmas", block1[5])],
      ["community_settings", unwrapQuery("community_settings", block1[7])],
      ["area_pastors", unwrapQuery("area_pastors", block3[7])],
      ["community_challenges", unwrapQuery("community_challenges", block1[8])],
      ["lessons", unwrapQuery("lessons", block1[1])],
      ["course_unlocks", unwrapQuery("course_unlocks", block1[9])],
      ["ranking_seasons", unwrapQuery("ranking_seasons", block3[8])],
      ["lesson_content", unwrapQuery("lesson_content", block1[2])],
      ["devotional_content", unwrapQuery("devotional_content", block1[3])],
      ["events", unwrapQuery("events", block1[6])],
      ["leader_meeting_notes", unwrapQuery("leader_meeting_notes", block3[4])],
      ["messages", unwrapQuery("messages", block3[5])],
      ["profiles", unwrapQuery("profiles", block2[0])],
      ["user_roles", unwrapQuery("user_roles", block2[1])],
      ["user_progress", unwrapQuery("user_progress", block2[2])],
      ["lesson_responses", unwrapQuery("lesson_responses", block2[3])],
      ["devotional_progress", unwrapQuery("devotional_progress", block2[4])],
      ["devotional_responses", unwrapQuery("devotional_responses", block2[5])],
      ["attendance", unwrapQuery("attendance", block2[6])],
      ["worship_attendance", unwrapQuery("worship_attendance", block2[7])],
      ["achievement_unlocks", unwrapQuery("achievement_unlocks", block2[8])],
      ["challenge_participants", unwrapQuery("challenge_participants", block3[9])],
      ["meeting_evaluations", unwrapQuery("meeting_evaluations", block3[3])],
      ["message_reactions", unwrapQuery("message_reactions", block3[6])],
      ["discipleship_plans", unwrapQuery("discipleship_plans", block3[0])],
      ["pastoral_notes", unwrapQuery("pastoral_notes", block3[1])],
      ["spiritual_assessments", unwrapQuery("spiritual_assessments", block3[2])],
      ["notification_preferences", unwrapQuery("notification_preferences", block3[10])],
      ["community_chat", unwrapQuery("community_chat", block3[11])],
      ["prayer_requests", unwrapQuery("prayer_requests", block3[12])],
      ["testimonies", unwrapQuery("testimonies", block3[13])],
      ["user_devotional_overrides", unwrapQuery("user_devotional_overrides", block4[0] as GenericRowsResult)],
      ["user_lesson_overrides", unwrapQuery("user_lesson_overrides", block4[1] as GenericRowsResult)],
    ] as Array<[string, Record<string, unknown>[]]>;

    return sections.map(([table, rows]) => buildInserts(table, rows)).join("");
  }

  async function fetchPersonalData(userId: string) {
    const results = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId),
      supabase.from("user_roles").select("role, admin_area, created_at").eq("user_id", userId),
      supabase.from("user_progress").select("*").eq("user_id", userId),
      supabase.from("lesson_responses").select("*").eq("user_id", userId),
      supabase.from("devotional_progress").select("*").eq("user_id", userId),
      supabase.from("devotional_responses").select("*").eq("user_id", userId),
      supabase.from("attendance").select("*").eq("user_id", userId),
      supabase.from("worship_attendance").select("*").eq("user_id", userId),
      supabase.from("achievement_unlocks").select("*").eq("user_id", userId),
      supabase.from("challenge_participants").select("*").eq("user_id", userId),
      supabase.from("meeting_evaluations").select("*").eq("user_id", userId),
      supabase.from("discipleship_plans").select("*").eq("user_id", userId),
      supabase.from("spiritual_assessments").select("*").eq("user_id", userId),
      supabase.from("notification_preferences").select("*").eq("user_id", userId),
      supabase.from("community_chat").select("*").eq("user_id", userId),
      supabase.from("prayer_requests").select("*").eq("user_id", userId),
      supabase.from("testimonies").select("*").eq("user_id", userId),
      supabase.from("push_subscriptions").select("created_at, updated_at, endpoint").eq("user_id", userId),
      supabase.from("message_views").select("*").eq("user_id", userId),
      supabase.from("whatsapp_reminder_log" as never).select("*").eq("user_id", userId),
      supabase.from("prayer_pairs").select("*").or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`),
    ]);

    const labels = [
      "profiles",
      "user_roles",
      "user_progress",
      "lesson_responses",
      "devotional_progress",
      "devotional_responses",
      "attendance",
      "worship_attendance",
      "achievement_unlocks",
      "challenge_participants",
      "meeting_evaluations",
      "discipleship_plans",
      "spiritual_assessments",
      "notification_preferences",
      "community_chat",
      "prayer_requests",
      "testimonies",
      "push_subscriptions",
      "message_views",
      "whatsapp_reminder_log",
      "prayer_pairs",
    ];

    return labels.reduce<Record<string, unknown[]>>((acc, label, index) => {
      const result = results[index];
      if (result.error) {
        acc[label] = [{ error: result.error.message }];
      } else {
        acc[label] = result.data ?? [];
      }
      return acc;
    }, {});
  }

  async function handlePersonalExport() {
    if (!user?.id) return;

    setLoading(true);
    const exportType: AuditExportType = "personal_json";
    try {
      setStatus("Preparando seus dados...");
      await auditExport(exportType, "self", "started");
      const date = new Date().toISOString().slice(0, 10);
      const personalData = await fetchPersonalData(user.id);
      const payload = {
        generated_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email ?? null,
        profile_name: profile?.full_name ?? null,
        data: personalData,
      };

      downloadFile(JSON.stringify(payload, null, 2), `meus-dados-${date}.json`, "application/json;charset=utf-8");
      await auditExport(exportType, "self", "completed", { tables: Object.keys(personalData).length });
      setStatus("Seus dados foram exportados.");
    } catch (err) {
      console.error(err);
      await auditExport(exportType, "self", "failed", { error: String(err) });
      setStatus("Erro: " + String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminExport(mode: AdminExportMode) {
    if (!isSystemAdmin) {
      setStatus("Apenas administradores do sistema podem exportar backup completo.");
      return;
    }

    const exportType: AuditExportType = mode === "schema" ? "admin_schema" : mode === "data" ? "admin_data" : "admin_full";
    setLoading(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await auditExport(exportType, "system", "started", { mode });

      if (mode === "schema") {
        setStatus("Gerando schema...");
        const sql = buildHeader("SCHEMA (Estrutura)") + SCHEMA_SQL;
        downloadFile(sql, `schema-${date}.sql`, "text/sql;charset=utf-8");
        setStatus("Schema exportado.");
      } else if (mode === "data") {
        setStatus("Buscando dados...");
        const dataSql = buildHeader("DADOS") + await fetchAllData();
        downloadFile(dataSql, `dados-${date}.sql`, "text/sql;charset=utf-8");
        setStatus("Dados exportados.");
      } else {
        setStatus("Buscando dados...");
        let sql = buildHeader("EXPORT COMPLETO");
        sql += "-- PARTE 1: ESTRUTURA\n\n" + SCHEMA_SQL;
        sql += "\n\n-- PARTE 2: DADOS\n\n" + await fetchAllData();
        downloadFile(sql, `completo-${date}.sql`, "text/sql;charset=utf-8");
        setStatus("Arquivo completo exportado.");
      }

      await auditExport(exportType, "system", "completed", { mode });
    } catch (err) {
      console.error(err);
      await auditExport(exportType, "system", "failed", { mode, error: String(err) });
      setStatus("Erro: " + String(err));
    } finally {
      setLoading(false);
    }
  }

  async function listKnownStorageBuckets() {
    const results = await Promise.all(
      MIGRATION_BUCKETS.map(async (bucket) => {
        const { data, error } = await supabase.storage.from(bucket).list("", {
          limit: 1000,
          sortBy: { column: "name", order: "asc" },
        });

        return {
          bucket,
          status: error ? "error" : "listed",
          error: error?.message ?? null,
          note: "Listagem limitada ao nivel raiz e as policies disponiveis para este usuario.",
          files: (data ?? []).map((item: StorageListItem) => ({
            name: item.name,
            id: item.id ?? null,
            created_at: item.created_at ?? null,
            updated_at: item.updated_at ?? null,
            last_accessed_at: item.last_accessed_at ?? null,
            metadata: item.metadata ?? null,
          })),
        };
      })
    );

    return results;
  }

  async function handleMigrationPackage() {
    if (!isSystemAdmin) {
      setStatus("Apenas administradores do sistema podem preparar pacote de migracao.");
      return;
    }

    setLoading(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      await auditExport("admin_full", "system", "started", { mode: "migration_package" });
      setStatus("Preparando pacote de migracao...");

      const [dataSql, storage] = await Promise.all([
        fetchAllData(),
        listKnownStorageBuckets(),
      ]);

      const fullSql = buildHeader("PACOTE DE MIGRACAO - SCHEMA + DADOS PUBLIC") +
        "-- Este arquivo nao inclui Auth, senhas, Storage binario, secrets, Edge Functions ou cron jobs.\n\n" +
        "-- PARTE 1: ESTRUTURA\n\n" +
        SCHEMA_SQL +
        "\n\n-- PARTE 2: DADOS PUBLIC\n\n" +
        dataSql;

      const manifest = {
        generated_at: new Date().toISOString(),
        generated_by: {
          user_id: user?.id ?? null,
          email: user?.email ?? null,
          name: profile?.full_name ?? null,
        },
        source_project: {
          supabase_url: import.meta.env.VITE_SUPABASE_URL ?? null,
          project_id: import.meta.env.VITE_SUPABASE_PROJECT_ID ?? null,
        },
        included_files: [
          `pacote-migracao-${date}.sql`,
          `manifesto-migracao-${date}.json`,
        ],
        included: {
          schema_sql: true,
          public_table_data_sql: true,
          public_tables: MIGRATION_TABLES,
          storage_bucket_listing_attempted: true,
          storage_buckets: storage,
        },
        not_included: {
          auth_passwords: "Senhas nunca sao exportadas pelo app.",
          auth_users_full_dump: "Use Supabase Dashboard/CLI para exportar usuarios Auth quando necessario.",
          storage_binary_files: "O manifesto lista arquivos quando a policy permite, mas nao baixa os binarios.",
          secrets: "Secrets precisam ser recriados manualmente no novo projeto.",
          edge_functions: "Funcoes devem ser publicadas novamente a partir do repositorio.",
          cron_jobs: "Agendamentos precisam ser recriados no novo Supabase.",
          project_settings: "Configuracoes internas do projeto devem ser revisadas manualmente.",
        },
        manual_checklist: MANUAL_MIGRATION_ITEMS,
        recommended_order: [
          "Criar novo projeto Supabase.",
          "Aplicar migrations/schema.",
          "Restaurar dados public do arquivo SQL.",
          "Criar buckets e copiar arquivos Storage.",
          "Configurar Auth, redirects e usuarios.",
          "Configurar secrets.",
          "Publicar Edge Functions.",
          "Recriar cron jobs.",
          "Testar login, perfil, notificacoes, pagamentos e exportacao LGPD.",
        ],
      };

      downloadFile(fullSql, `pacote-migracao-${date}.sql`, "text/sql;charset=utf-8");
      downloadFile(JSON.stringify(manifest, null, 2), `manifesto-migracao-${date}.json`, "application/json;charset=utf-8");
      await auditExport("admin_full", "system", "completed", { mode: "migration_package" });
      setStatus("Pacote de migracao gerado. Baixe tambem Auth, Storage e secrets pelos canais administrativos.");
    } catch (err) {
      console.error(err);
      await auditExport("admin_full", "system", "failed", { mode: "migration_package", error: String(err) });
      setStatus("Erro ao preparar pacote de migracao: " + String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handlePrivacyRequest() {
    if (!user?.id) return;

    setSubmittingPrivacyRequest(true);
    try {
      const { error } = await supabase.from("privacy_requests" as never).insert({
        user_id: user.id,
        request_type: privacyRequestType,
        details: privacyRequestDetails.trim() || null,
      } as never);

      if (error) throw error;
      setPrivacyRequestDetails("");
      setStatus("Solicitacao de privacidade registrada. A equipe responsavel devera analisar o pedido.");
    } catch (err) {
      console.error(err);
      setStatus("Erro ao registrar solicitacao: " + String(err));
    } finally {
      setSubmittingPrivacyRequest(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-4">
        <Card className="border-border">
          <CardHeader className="text-center">
            <CardTitle className="font-montserrat font-black text-xl text-foreground">Privacidade e Dados</CardTitle>
            <CardDescription>
              Baixe seus dados pessoais, revise seus direitos ou, se autorizado, gere backups administrativos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handlePersonalExport} disabled={loading} className="w-full" size="lg">
              Exportar meus dados pessoais
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Este arquivo contem apenas registros ligados ao seu usuario.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-montserrat text-lg font-black text-foreground">Solicitacao LGPD</CardTitle>
            <CardDescription>
              Registre um pedido de exclusao, correcao ou revisao de consentimento para analise administrativa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">Tipo de solicitacao</label>
              <select
                value={privacyRequestType}
                onChange={(event) => setPrivacyRequestType(event.target.value as PrivacyRequestType)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="data_deletion">Excluir meus dados</option>
                <option value="data_correction">Corrigir meus dados</option>
                <option value="consent_review">Revisar consentimentos</option>
                <option value="other">Outro pedido</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-inter font-medium text-muted-foreground">Detalhes</label>
              <textarea
                value={privacyRequestDetails}
                onChange={(event) => setPrivacyRequestDetails(event.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Descreva o que voce precisa."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <Button
              onClick={handlePrivacyRequest}
              disabled={submittingPrivacyRequest}
              className="w-full"
              variant="outline"
            >
              {submittingPrivacyRequest ? "Registrando..." : "Registrar solicitacao"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              A exclusao nao e automatica para evitar perda indevida de registros administrativos ou legais.
            </p>
          </CardContent>
        </Card>

        {isSystemAdmin && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="font-montserrat text-lg font-black text-foreground">Backup administrativo</CardTitle>
              <CardDescription>
                Area restrita a administradores do sistema. Toda exportacao e registrada em auditoria.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => handleAdminExport("schema")} disabled={loading} className="w-full" size="lg" variant="outline">
                Exportar Schema (Estrutura)
              </Button>
              <Button onClick={() => handleAdminExport("data")} disabled={loading} className="w-full" size="lg" variant="outline">
                Exportar Dados (Registros)
              </Button>
              <Button onClick={() => handleAdminExport("all")} disabled={loading} className="w-full" size="lg">
                Exportar Tudo (Schema + Dados)
              </Button>
              <Button onClick={handleMigrationPackage} disabled={loading} className="w-full" size="lg" variant="secondary">
                Preparar migracao completa
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Gera SQL + manifesto. Auth, senhas, arquivos Storage e secrets exigem etapas administrativas.
              </p>
            </CardContent>
          </Card>
        )}

        {!checkingAccess && !isSystemAdmin && (
          <Card className="border-border bg-muted/30">
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              Backup completo oculto: somente administradores do sistema autorizados podem acessar exportacoes amplas.
            </CardContent>
          </Card>
        )}

        {status && <p className="text-sm font-inter text-muted-foreground text-center">{status}</p>}

        <div className="text-center">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-xs">
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
