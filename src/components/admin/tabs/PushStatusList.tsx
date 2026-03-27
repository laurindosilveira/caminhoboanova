import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, BellOff, CheckCircle, Search, RefreshCw, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PushUser {
  user_id: string;
  full_name: string;
  community: string;
  has_push: boolean;
  endpoint_count: number;
  reminder_sent: boolean;
}

interface Props {
  adminArea?: string;
}

type Filter = "all" | "active" | "inactive";

export default function PushStatusList({ adminArea }: Props) {
  const [users, setUsers] = useState<PushUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const { toast } = useToast();

  async function fetchData() {
    setLoading(true);
    try {
      const profilesQuery = supabase
        .from("profiles")
        .select("user_id, full_name, community, area");

      if (adminArea) {
        profilesQuery.eq("area", adminArea as any);
      }

      const [{ data: profiles }, { data: subs }, { data: roles }, { data: reminders }] = await Promise.all([
        profilesQuery,
        supabase.from("push_subscriptions").select("user_id, endpoint"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("push_activation_reminders" as any).select("target_user_id, dismissed_at, created_at").is("dismissed_at", null),
      ]);

      const adminIds = new Set(
        (roles ?? [])
          .filter(r => r.role === "admin" || r.role === "lider")
          .map(r => r.user_id)
      );

      const subMap = new Map<string, number>();
      (subs ?? []).forEach(s => {
        subMap.set(s.user_id, (subMap.get(s.user_id) ?? 0) + 1);
      });

      // Only consider reminders sent within the last 24 hours as "active"
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
      const reminderSet = new Set(
        (reminders ?? [])
          .filter((r: any) => now - new Date(r.created_at).getTime() < TWENTY_FOUR_HOURS)
          .map((r: any) => r.target_user_id)
      );

      const result: PushUser[] = (profiles ?? [])
        .filter(p => !adminIds.has(p.user_id))
        .map(p => ({
          user_id: p.user_id,
          full_name: p.full_name,
          community: p.community,
          has_push: subMap.has(p.user_id),
          endpoint_count: subMap.get(p.user_id) ?? 0,
          reminder_sent: reminderSet.has(p.user_id),
        }))
        .sort((a, b) => {
          if (a.has_push !== b.has_push) return a.has_push ? -1 : 1;
          return a.full_name.localeCompare(b.full_name);
        });

      setUsers(result);
    } catch (err) {
      console.error("Failed to fetch push status:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [adminArea]);

  async function handleSendReminder(userId: string) {
    setSendingReminder(userId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("push_activation_reminders" as any).insert({
        target_user_id: userId,
        sent_by: user.id,
      } as any);

      if (error) throw error;

      setUsers(prev => prev.map(u =>
        u.user_id === userId ? { ...u, reminder_sent: true } : u
      ));
      toast({ title: "Lembrete enviado!", description: "O aluno verá um aviso para ativar notificações." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSendingReminder(null);
    }
  }

  async function handleSendAllReminders() {
    const inactiveWithoutReminder = users.filter(u => !u.has_push && !u.reminder_sent);
    if (inactiveWithoutReminder.length === 0) return;

    setSendingReminder("all");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const rows = inactiveWithoutReminder.map(u => ({
        target_user_id: u.user_id,
        sent_by: user.id,
      }));

      const { error } = await supabase.from("push_activation_reminders" as any).insert(rows as any);
      if (error) throw error;

      setUsers(prev => prev.map(u =>
        !u.has_push ? { ...u, reminder_sent: true } : u
      ));
      toast({ title: "Lembretes enviados!", description: `${inactiveWithoutReminder.length} aluno(s) receberão o aviso.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSendingReminder(null);
    }
  }

  let filtered = users;
  if (filter === "active") filtered = users.filter(u => u.has_push);
  if (filter === "inactive") filtered = users.filter(u => !u.has_push);

  if (search.trim()) {
    filtered = filtered.filter(u =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.community.toLowerCase().includes(search.toLowerCase())
    );
  }

  const enabledCount = users.filter(u => u.has_push).length;
  const disabledCount = users.filter(u => !u.has_push).length;
  const inactiveWithoutReminder = users.filter(u => !u.has_push && !u.reminder_sent);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-montserrat font-bold text-foreground text-sm flex items-center gap-2">
          📊 Status Push dos Alunos
        </h3>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary cards - also act as filter buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setFilter(filter === "all" ? "all" : "all")}
          className={`flex flex-col items-center p-2.5 rounded-xl border transition-colors ${
            filter === "all" ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30"
          }`}
        >
          <p className={`font-inter font-bold text-sm ${filter === "all" ? "text-primary" : "text-foreground"}`}>{users.length}</p>
          <p className={`font-inter text-[10px] ${filter === "all" ? "text-primary/70" : "text-muted-foreground"}`}>Todos</p>
        </button>
        <button
          onClick={() => setFilter(filter === "active" ? "all" : "active")}
          className={`flex items-center gap-1.5 p-2.5 rounded-xl border transition-colors ${
            filter === "active" ? "border-brand-green bg-brand-green/10" : "border-border bg-card hover:border-brand-green/30"
          }`}
        >
          <Bell className={`w-3.5 h-3.5 flex-shrink-0 ${filter === "active" ? "text-brand-green" : "text-muted-foreground"}`} />
          <div>
            <p className={`font-inter font-bold text-sm ${filter === "active" ? "text-brand-green" : "text-foreground"}`}>{enabledCount}</p>
            <p className={`font-inter text-[10px] ${filter === "active" ? "text-brand-green/70" : "text-muted-foreground"}`}>Ativos</p>
          </div>
        </button>
        <button
          onClick={() => setFilter(filter === "inactive" ? "all" : "inactive")}
          className={`flex items-center gap-1.5 p-2.5 rounded-xl border transition-colors ${
            filter === "inactive" ? "border-destructive bg-destructive/10" : "border-border bg-card hover:border-destructive/30"
          }`}
        >
          <BellOff className={`w-3.5 h-3.5 flex-shrink-0 ${filter === "inactive" ? "text-destructive" : "text-muted-foreground"}`} />
          <div>
            <p className={`font-inter font-bold text-sm ${filter === "inactive" ? "text-destructive" : "text-foreground"}`}>{disabledCount}</p>
            <p className={`font-inter text-[10px] ${filter === "inactive" ? "text-destructive/70" : "text-muted-foreground"}`}>Inativos</p>
          </div>
        </button>
      </div>

      {/* Send all reminders button */}
      {inactiveWithoutReminder.length > 0 && (
        <button
          onClick={handleSendAllReminders}
          disabled={sendingReminder === "all"}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary bg-primary/5 text-primary text-xs font-inter font-bold hover:bg-primary/10 transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          {sendingReminder === "all" ? "Enviando..." : `Pedir ativação para ${inactiveWithoutReminder.length} aluno(s)`}
        </button>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar aluno..."
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-card text-sm font-inter text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* List */}
      {loading ? (
        <p className="text-muted-foreground text-xs font-inter text-center py-4 animate-pulse">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-xs font-inter text-center py-4">Nenhum aluno encontrado.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1 rounded-xl border border-border bg-card p-2">
          {filtered.map(u => (
            <div
              key={u.user_id}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-inter text-xs font-semibold text-foreground truncate">{u.full_name}</p>
                <p className="font-inter text-[10px] text-muted-foreground">{u.community}</p>
              </div>
              {u.has_push ? (
                <div className="flex items-center gap-1 text-brand-green">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-inter font-bold">
                    {u.endpoint_count > 1 ? `${u.endpoint_count} disp.` : "Ativo"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {u.reminder_sent ? (
                    <span className="text-[10px] font-inter font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Lembrete enviado</span>
                  ) : (
                    <button
                      onClick={() => handleSendReminder(u.user_id)}
                      disabled={sendingReminder === u.user_id}
                      className="text-[10px] font-inter font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      {sendingReminder === u.user_id ? "..." : "Pedir"}
                    </button>
                  )}
                  <span className="text-[10px] font-inter font-bold text-destructive/70">Inativo</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
