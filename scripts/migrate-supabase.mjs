import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const envPath = join(rootDir, ".env.migration");

const TABLES = [
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
  "push_subscriptions",
  "message_views",
  "whatsapp_reminder_log",
  "prayer_pairs",
  "user_devotional_overrides",
  "user_lesson_overrides",
  "data_export_audit",
  "privacy_requests",
];

const BUCKETS = ["avatars", "challenge-files", "chat-files", "event-photos"];

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function requireEnv(env, key) {
  const value = env[key] || process.env[key];
  if (!value) {
    throw new Error(`Variavel obrigatoria ausente: ${key}. Crie .env.migration a partir de .env.migration.example.`);
  }
  return value;
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

function safeFileName(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
}

function redact(value) {
  if (!value) return null;
  return `${String(value).slice(0, 8)}...redacted`;
}

async function fetchAllRows(supabase, table) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select("*").range(from, to);
    if (error) return { rows, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return { rows, error: null };
  }
}

async function backupTables(supabase, outputDir) {
  const tableDir = join(outputDir, "database");
  ensureDir(tableDir);
  const results = [];

  for (const table of TABLES) {
    process.stdout.write(`Tabela ${table}... `);
    const result = await fetchAllRows(supabase, table);
    if (result.error) {
      console.log(`erro: ${result.error}`);
      results.push({ table, status: "error", rows: result.rows.length, error: result.error });
      continue;
    }

    writeJson(join(tableDir, `${safeFileName(table)}.json`), result.rows);
    console.log(`${result.rows.length} linhas`);
    results.push({ table, status: "exported", rows: result.rows.length, file: `database/${safeFileName(table)}.json` });
  }

  return results;
}

async function listAuthUsers(supabase, outputDir) {
  const users = [];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) return { status: "error", error: error.message, users_count: users.length };
    users.push(...(data.users ?? []));
    if (!data.users || data.users.length < perPage) break;
  }

  const sanitized = users.map((user) => ({
    id: user.id,
    aud: user.aud,
    role: user.role,
    email: user.email,
    phone: user.phone,
    email_confirmed_at: user.email_confirmed_at,
    phone_confirmed_at: user.phone_confirmed_at,
    confirmed_at: user.confirmed_at,
    last_sign_in_at: user.last_sign_in_at,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
    identities: user.identities?.map((identity) => ({
      id: identity.id,
      user_id: identity.user_id,
      provider: identity.provider,
      identity_data: identity.identity_data,
      created_at: identity.created_at,
      updated_at: identity.updated_at,
    })),
    created_at: user.created_at,
    updated_at: user.updated_at,
  }));

  writeJson(join(outputDir, "auth", "users.json"), sanitized);
  return {
    status: "exported",
    users_count: sanitized.length,
    file: "auth/users.json",
    note: "Senhas e hashes de senha nao sao exportados. Planeje reset de senha ou migracao oficial de Auth.",
  };
}

async function listStorageFolder(supabase, bucket, prefix = "") {
  const entries = [];
  const limit = 1000;
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(error.message);
    const page = data ?? [];
    entries.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }

  const files = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    const isFolder = !entry.id && !entry.metadata;
    if (isFolder) {
      files.push(...await listStorageFolder(supabase, bucket, path));
    } else {
      files.push({
        path,
        id: entry.id ?? null,
        created_at: entry.created_at ?? null,
        updated_at: entry.updated_at ?? null,
        last_accessed_at: entry.last_accessed_at ?? null,
        metadata: entry.metadata ?? null,
      });
    }
  }

  return files;
}

async function downloadStorageFile(supabase, bucket, filePath, outputDir) {
  const { data, error } = await supabase.storage.from(bucket).download(filePath);
  if (error) throw new Error(error.message);
  const arrayBuffer = await data.arrayBuffer();
  const targetPath = join(outputDir, "storage", safeFileName(bucket), ...filePath.split("/").map(safeFileName));
  ensureDir(dirname(targetPath));
  writeFileSync(targetPath, Buffer.from(arrayBuffer));
  return targetPath;
}

async function backupStorage(supabase, outputDir) {
  const results = [];

  for (const bucket of BUCKETS) {
    process.stdout.write(`Bucket ${bucket}... `);
    try {
      const files = await listStorageFolder(supabase, bucket);
      const downloaded = [];
      for (const file of files) {
        try {
          const absolutePath = await downloadStorageFile(supabase, bucket, file.path, outputDir);
          downloaded.push({ ...file, status: "downloaded", file: absolutePath.replace(`${outputDir}\\`, "").replaceAll("\\", "/") });
        } catch (error) {
          downloaded.push({ ...file, status: "error", error: error.message });
        }
      }

      writeJson(join(outputDir, "storage", safeFileName(bucket), "_manifest.json"), downloaded);
      console.log(`${downloaded.filter((file) => file.status === "downloaded").length}/${files.length} arquivos`);
      results.push({
        bucket,
        status: "exported",
        files_count: files.length,
        downloaded_count: downloaded.filter((file) => file.status === "downloaded").length,
        manifest: `storage/${safeFileName(bucket)}/_manifest.json`,
      });
    } catch (error) {
      console.log(`erro: ${error.message}`);
      results.push({ bucket, status: "error", error: error.message });
    }
  }

  return results;
}

async function backupCron(supabase, outputDir) {
  try {
    const { data, error } = await supabase.schema("cron").from("job").select("*");
    if (error) throw new Error(error.message);
    writeJson(join(outputDir, "cron", "jobs.json"), data ?? []);
    return {
      status: "exported",
      jobs_count: data?.length ?? 0,
      file: "cron/jobs.json",
      note: "Recrie os jobs no novo projeto pelo Dashboard ou por SQL cron.schedule.",
    };
  } catch (error) {
    return {
      status: "error",
      error: error.message,
      note: "Se o schema cron nao estiver exposto via API, rode SELECT * FROM cron.job no SQL Editor.",
    };
  }
}

function listLocalFunctions(outputDir) {
  const functionsDir = join(rootDir, "supabase", "functions");
  if (!existsSync(functionsDir)) {
    return { status: "missing", functions: [], note: "Pasta supabase/functions nao encontrada." };
  }

  const entries = [];

  for (const name of readdirSync(functionsDir)) {
    const fullPath = join(functionsDir, name);
    if (statSync(fullPath).isDirectory()) entries.push(name);
  }

  const result = {
    status: "listed",
    functions: entries.sort(),
    note: "Backup do codigo vem do repositorio. Para baixar funcoes publicadas use supabase functions download.",
  };
  writeJson(join(outputDir, "functions", "local-functions.json"), result);
  return result;
}

async function main() {
  const env = { ...parseEnvFile(envPath), ...process.env };
  const sourceUrl = requireEnv(env, "SOURCE_SUPABASE_URL");
  const sourceKey = requireEnv(env, "SOURCE_SERVICE_ROLE_KEY");
  const targetUrl = env.TARGET_SUPABASE_URL || null;
  const targetKey = env.TARGET_SERVICE_ROLE_KEY || null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = join(rootDir, env.BACKUP_DIR || `backups/supabase-migration-${timestamp}`);

  ensureDir(outputDir);

  const source = createClient(sourceUrl, sourceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Backup iniciado em ${outputDir}`);
  console.log("Nenhum dado sera apagado ou enviado para outro projeto.");

  const [tables, auth, storage, cron] = await Promise.all([
    backupTables(source, outputDir),
    listAuthUsers(source, outputDir),
    backupStorage(source, outputDir),
    backupCron(source, outputDir),
  ]);

  const functions = listLocalFunctions(outputDir);
  const manifest = {
    generated_at: new Date().toISOString(),
    mode: "backup_only",
    source: {
      url: sourceUrl,
      service_role_key: redact(sourceKey),
    },
    target: {
      configured: Boolean(targetUrl && targetKey),
      url: targetUrl,
      service_role_key: redact(targetKey),
      note: "O script atual nao escreve no destino. Use estes dados apenas quando adicionarmos modo restore.",
    },
    database: tables,
    auth,
    storage,
    cron,
    functions,
    not_exported: {
      auth_passwords: "Nao exportado. Senhas nao devem ser extraidas; use redefinicao de senha ou ferramenta oficial.",
      secrets_values: "Nao exportado. Recrie secrets a partir de um cofre/.env seguro.",
      project_internal_settings: "Nao exportado. Revise Auth URLs, providers, SMTP, dominios, plano, backups e rate limits no Dashboard.",
      edge_function_runtime_secrets: "Nao exportado. Rode supabase secrets list/set conforme necessario.",
    },
    restore_checklist: [
      "Criar novo projeto Supabase.",
      "Aplicar migrations/schema no novo banco.",
      "Restaurar tabelas public a partir dos JSONs ou dump SQL oficial.",
      "Criar buckets e reenviar arquivos de backups/storage.",
      "Recriar usuarios Auth ou enviar redefinicao de senha.",
      "Configurar secrets no novo projeto.",
      "Publicar Edge Functions.",
      "Recriar cron jobs.",
      "Conferir URLs de Auth, dominios, SMTP e providers.",
      "Testar login, perfil, storage, notificacoes e pagamentos.",
    ],
  };

  writeJson(join(outputDir, "manifest.json"), manifest);
  console.log("Backup concluido.");
  console.log(`Manifesto: ${join(outputDir, "manifest.json")}`);
}

main().catch((error) => {
  console.error("Falha no backup:", error.message);
  process.exitCode = 1;
});
