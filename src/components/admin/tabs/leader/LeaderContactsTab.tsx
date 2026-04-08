import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAreaSwitch } from "@/contexts/AreaSwitchContext";
import { Users, Phone, Search, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Contact = {
  user_id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  father_name: string | null;
  father_phone: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  community: string | null;
};

function whatsappLink(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // Add Brazil country code if not present
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}

function age(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  return `${years} anos`;
}

function ContactCard({ c }: { c: Contact }) {
  const [expanded, setExpanded] = useState(false);
  const hasParents = !!(c.father_name || c.mother_name);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Member row */}
      <button
        onClick={() => hasParents && setExpanded(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${hasParents ? "hover:bg-muted/30 transition-colors" : ""}`}
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="font-montserrat font-black text-primary text-sm">
            {c.full_name.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-montserrat font-bold text-foreground text-sm truncate">{c.full_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {c.community && (
              <span className="text-muted-foreground font-inter text-[10px]">{c.community}</span>
            )}
            {age(c.birth_date) && (
              <span className="text-muted-foreground font-inter text-[10px]">{age(c.birth_date)}</span>
            )}
            {c.phone && (
              <a
                href={whatsappLink(c.phone) ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-[#25D366] font-inter text-[10px] font-medium hover:underline"
              >
                <MessageCircle className="w-3 h-3" />
                {c.phone}
              </a>
            )}
          </div>
        </div>

        {hasParents && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] font-inter text-muted-foreground">pais</span>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />
            }
          </div>
        )}
      </button>

      {/* Parents section */}
      {expanded && hasParents && (
        <div className="px-4 pb-3 pt-1 border-t border-border space-y-2 bg-muted/20 animate-in slide-in-from-top-1 duration-150">
          {c.father_name && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none">👨</span>
                <div className="min-w-0">
                  <p className="font-inter text-xs font-semibold text-foreground truncate">{c.father_name}</p>
                  <p className="font-inter text-[10px] text-muted-foreground">Pai</p>
                </div>
              </div>
              {c.father_phone && (
                <a
                  href={whatsappLink(c.father_phone) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] font-inter text-[11px] font-medium hover:bg-[#25D366]/20 transition-colors flex-shrink-0"
                >
                  <MessageCircle className="w-3 h-3" />
                  {c.father_phone}
                </a>
              )}
            </div>
          )}
          {c.mother_name && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none">👩</span>
                <div className="min-w-0">
                  <p className="font-inter text-xs font-semibold text-foreground truncate">{c.mother_name}</p>
                  <p className="font-inter text-[10px] text-muted-foreground">Mãe</p>
                </div>
              </div>
              {c.mother_phone && (
                <a
                  href={whatsappLink(c.mother_phone) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] font-inter text-[11px] font-medium hover:bg-[#25D366]/20 transition-colors flex-shrink-0"
                >
                  <MessageCircle className="w-3 h-3" />
                  {c.mother_phone}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeaderContactsTab() {
  const { profile } = useAuth();
  const { effectiveArea } = useAreaSwitch();
  const { toast } = useToast();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchContacts();
  }, [profile?.turma_id, effectiveArea]);

  async function fetchContacts() {
    setLoading(true);

    let query = supabase
      .from("profiles")
      .select("user_id, full_name, phone, birth_date, father_name, father_phone, mother_name, mother_phone, community")
      .order("full_name");

    // Scope to leader's turma if assigned, otherwise to area
    if (profile?.turma_id) {
      query = query.eq("turma_id", profile.turma_id);
    } else {
      const myArea = effectiveArea || profile?.area;
      if (myArea) query = query.eq("area", myArea as any);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Erro ao carregar contatos", description: error.message, variant: "destructive" });
    } else {
      setContacts(data ?? []);
    }
    setLoading(false);
  }

  const filtered = contacts.filter(c =>
    !search ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.father_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.mother_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const withParents = filtered.filter(c => c.father_name || c.mother_name);
  const withoutParents = filtered.filter(c => !c.father_name && !c.mother_name);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-montserrat font-black text-foreground text-base">Contatos</h2>
          <p className="text-muted-foreground text-xs font-inter">
            {profile?.turma_id ? "Membros da sua turma" : "Membros da sua área"} · {contacts.length} pessoa{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou responsável..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground font-inter text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-inter text-sm">
            {search ? "Nenhum resultado encontrado." : "Nenhum membro encontrado."}
          </p>
        </div>
      ) : (
        <>
          {/* Members with parent contacts */}
          {withParents.length > 0 && (
            <div className="space-y-2">
              {!search && (
                <p className="font-inter text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                  Com contato dos pais ({withParents.length})
                </p>
              )}
              {withParents.map(c => <ContactCard key={c.user_id} c={c} />)}
            </div>
          )}

          {/* Members without parent contacts */}
          {withoutParents.length > 0 && !search && (
            <div className="space-y-2 mt-4">
              <p className="font-inter text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                Sem contato dos pais ({withoutParents.length})
              </p>
              {withoutParents.map(c => <ContactCard key={c.user_id} c={c} />)}
            </div>
          )}

          {/* When searching, show all results together */}
          {search && withoutParents.map(c => <ContactCard key={c.user_id} c={c} />)}
        </>
      )}
    </div>
  );
}
