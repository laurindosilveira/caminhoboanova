import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, GraduationCap, Search, UserPlus, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

type WaitingUser = {
  user_id: string;
  full_name: string;
  community: string;
  area: string;
  phone: string;
  birth_date: string;
  turma_id: string | null;
  enrollment_status: "pending" | "approved" | "rejected";
};

type Turma = {
  id: string;
  name: string;
  year: number;
  area: string | null;
};

interface Props {
  areaFilter: string;
  onAssigned?: () => void;
}

export default function LeaderWaitingRoom({ areaFilter, onAssigned }: Props) {
  const { toast } = useToast();
  const [users, setUsers] = useState<WaitingUser[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    void fetchData();
  }, [areaFilter]);

  async function fetchData() {
    setLoading(true);

    const [
      { data: profiles, error: profilesError },
      { data: turmasData, error: turmasError },
      userResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, community, area, phone, birth_date, turma_id, enrollment_status")
        .is("turma_id", null)
        .eq("enrollment_status", "pending")
        .eq("area", areaFilter),
      supabase
        .from("turmas")
        .select("id, name, year, area")
        .eq("is_active", true)
        .eq("area", areaFilter)
        .order("year", { ascending: false }),
      supabase.auth.getUser(),
    ]);

    if (profilesError || turmasError) {
      toast({
        title: "Erro ao carregar sala de espera",
        description: profilesError?.message ?? turmasError?.message ?? "Nao foi possivel carregar os dados.",
        variant: "destructive",
      });
      setUsers([]);
      setTurmas([]);
      setLoading(false);
      return;
    }

    const myId = userResult.data.user?.id;
    setUsers((profiles ?? []).filter((profile) => profile.user_id !== myId));
    setTurmas(turmasData ?? []);
    setLoading(false);
  }

  async function assignTurma(userId: string, turmaId: string, userName: string) {
    const turma = turmas.find((item) => item.id === turmaId);
    if (!turma) {
      toast({
        title: "Turma invalida",
        description: "Selecione uma turma ativa da mesma area.",
        variant: "destructive",
      });
      return;
    }

    setSaving(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ turma_id: turmaId, enrollment_status: "approved" })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Atribuido",
        description: `${userName} foi adicionado a turma "${turma.name}".`,
      });
      setUsers((prev) => prev.filter((user) => user.user_id !== userId));
      onAssigned?.();
    }

    setSaving(null);
  }

  async function rejectUser(userId: string, userName: string) {
    const confirmed = window.confirm(`Rejeitar o cadastro de ${userName}?`);
    if (!confirmed) return;

    setSaving(userId);
    const { error } = await supabase
      .from("profiles")
      .update({ turma_id: null, enrollment_status: "rejected" })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Erro ao rejeitar", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Usuario rejeitado",
        description: `${userName} foi removido da sala de espera.`,
      });
      setUsers((prev) => prev.filter((user) => user.user_id !== userId));
      onAssigned?.();
    }

    setSaving(null);
  }

  const filtered = users.filter((user) =>
    user.full_name.toLowerCase().includes(search.toLowerCase()) ||
    user.community.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center">
          <Clock className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h2 className="font-montserrat font-black text-foreground text-lg">Sala de Espera</h2>
          <p className="text-muted-foreground text-xs font-inter">
            Usuarios da {areaFilter} aguardando turma
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9 rounded-2xl border-border"
        />
      </div>

      {turmas.length === 0 && (
        <div className="bg-secondary/10 border border-secondary/30 rounded-2xl px-4 py-3">
          <p className="text-secondary font-inter text-xs font-medium">
            Nenhuma turma ativa nesta area.
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-muted rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-3">
            <UserPlus className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-inter text-sm">
            {users.length === 0
              ? "Nenhum usuario da sua area aguardando turma."
              : "Nenhum resultado para a busca."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => {
            const initials = user.full_name
              .split(" ")
              .map((name) => name[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <div
                key={user.user_id}
                className={`bg-card border border-border rounded-2xl p-4 space-y-3 ${
                  saving === user.user_id ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 font-montserrat font-black text-sm text-muted-foreground">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-montserrat font-bold text-foreground text-sm truncate">
                      {user.full_name}
                    </p>
                    <p className="text-muted-foreground text-xs font-inter">
                      {user.community} · {user.area}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {turmas.length > 0 && (
                    <>
                      {turmas.map((turma) => (
                        <button
                          key={turma.id}
                          onClick={() => assignTurma(user.user_id, turma.id, user.full_name)}
                          disabled={saving === user.user_id}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all disabled:opacity-50"
                        >
                          <GraduationCap className="w-3 h-3" />
                          {turma.name}
                        </button>
                      ))}
                    </>
                  )}
                  <button
                    onClick={() => rejectUser(user.user_id, user.full_name)}
                    disabled={saving === user.user_id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-all disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" />
                    Rejeitar
                  </button>
                  </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
