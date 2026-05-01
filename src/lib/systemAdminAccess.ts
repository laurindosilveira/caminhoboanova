import { supabase } from "@/integrations/supabase/client";

export async function isAuthorizedSystemAdmin() {
  const { data, error } = await supabase.rpc("is_authorized_system_admin" as any);
  if (error) {
    console.error("Erro ao verificar admin autorizado do sistema:", error);
    return false;
  }

  return data === true;
}
