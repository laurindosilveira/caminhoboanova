import { supabase } from "@/integrations/supabase/client";

export async function isAuthorizedSystemAdmin(userEmail?: string | null) {
  if (!userEmail) return false;

  const normalizedEmail = userEmail.trim().toLowerCase();

  const { data, error } = await supabase
    .from("authorized_system_admins" as any)
    .select("email, is_active")
    .eq("email", normalizedEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Erro ao verificar admin autorizado do sistema:", error);
    return false;
  }

  return !!data;
}
