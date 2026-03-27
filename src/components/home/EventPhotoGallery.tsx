import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, ChevronLeft, Upload, Trash2, Check, X, Clock, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EventAlbum {
  id: string;
  title: string;
  event_date: string;
  photo_count: number;
  cover_url: string | null;
}

interface Photo {
  id: string;
  file_url: string;
  caption: string;
  status: string;
  user_id: string;
  user_name?: string;
  created_at: string;
}

export default function EventPhotoGallery() {
  const { profile, role } = useAuth();
  const isLeaderOrAdmin = role === "admin" || role === "lider";
  const [albums, setAlbums] = useState<EventAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<EventAlbum | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAlbums();
  }, []);

  async function fetchAlbums() {
    setLoading(true);
    // Get events that have photos (or are past events)
    const { data: events } = await supabase
      .from("events")
      .select("id, title, event_date")
      .order("event_date", { ascending: false });

    if (!events) { setLoading(false); return; }

    // Get photo counts per event
    const { data: photosData } = await supabase
      .from("event_photos")
      .select("id, event_id, file_url, status");

    const photosByEvent = new Map<string, { count: number; cover: string | null }>();
    (photosData ?? []).forEach((p: any) => {
      if (p.status !== "aprovado" && !isLeaderOrAdmin && p.user_id !== profile?.user_id) return;
      const entry = photosByEvent.get(p.event_id) || { count: 0, cover: null };
      entry.count++;
      if (!entry.cover) entry.cover = p.file_url;
      photosByEvent.set(p.event_id, entry);
    });

    const albumList: EventAlbum[] = events
      .filter(e => {
        const info = photosByEvent.get(e.id);
        return info && info.count > 0;
      })
      .map(e => {
        const info = photosByEvent.get(e.id)!;
        return {
          id: e.id,
          title: e.title,
          event_date: e.event_date,
          photo_count: info.count,
          cover_url: info.cover,
        };
      });

    // Also add events without photos but that are past (for upload)
    const now = new Date();
    events.forEach(e => {
      if (!photosByEvent.has(e.id) && new Date(e.event_date) <= now) {
        albumList.push({
          id: e.id,
          title: e.title,
          event_date: e.event_date,
          photo_count: 0,
          cover_url: null,
        });
      }
    });

    // Sort by date desc
    albumList.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
    setAlbums(albumList);
    setLoading(false);
  }

  async function openAlbum(album: EventAlbum) {
    setSelectedAlbum(album);
    setLoadingPhotos(true);
    const { data } = await supabase
      .from("event_photos")
      .select("id, file_url, caption, status, user_id, created_at")
      .eq("event_id", album.id)
      .order("created_at", { ascending: false });

    // Get user names
    const userIds = [...new Set((data ?? []).map((p: any) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));

    setPhotos((data ?? []).map((p: any) => ({
      ...p,
      user_name: nameMap.get(p.user_id) || "Desconhecido",
    })));
    setLoadingPhotos(false);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !selectedAlbum || !profile) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    let uploadedCount = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${selectedAlbum.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        toast.error(`Erro ao enviar ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from("event-photos").getPublicUrl(path);

      await supabase.from("event_photos").insert({
        event_id: selectedAlbum.id,
        user_id: user.id,
        file_url: urlData.publicUrl,
        status: isLeaderOrAdmin ? "aprovado" : "pendente",
      });
      uploadedCount++;
    }

    if (uploadedCount > 0) {
      toast.success(
        isLeaderOrAdmin
          ? `${uploadedCount} foto(s) enviada(s) com sucesso!`
          : `${uploadedCount} foto(s) enviada(s)! Aguardando aprovação do líder.`
      );
      openAlbum(selectedAlbum);
      fetchAlbums();
    }
    setUploading(false);
  }

  async function handleApprove(photoId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("event_photos").update({
      status: "aprovado",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", photoId);
    toast.success("Foto aprovada!");
    if (selectedAlbum) openAlbum(selectedAlbum);
  }

  async function handleReject(photoId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("event_photos").update({
      status: "rejeitado",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", photoId);
    toast.info("Foto rejeitada.");
    if (selectedAlbum) openAlbum(selectedAlbum);
  }

  async function handleDelete(photo: Photo) {
    await supabase.from("event_photos").delete().eq("id", photo.id);
    toast.info("Foto removida.");
    if (selectedAlbum) openAlbum(selectedAlbum);
    fetchAlbums();
    if (viewingPhoto?.id === photo.id) setViewingPhoto(null);
  }

  // Fullscreen photo viewer
  if (viewingPhoto) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => setViewingPhoto(null)} className="text-white/80 hover:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center flex-1">
            <p className="text-white/60 text-xs font-inter">{viewingPhoto.user_name}</p>
          </div>
          {(isLeaderOrAdmin || viewingPhoto.user_id === profile?.user_id) && (
            <button onClick={() => handleDelete(viewingPhoto)} className="text-destructive/80 hover:text-destructive">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <img
            src={viewingPhoto.file_url}
            alt={viewingPhoto.caption || "Foto do evento"}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
        {viewingPhoto.caption && (
          <p className="text-white/70 text-center text-sm font-inter px-4 pb-4">{viewingPhoto.caption}</p>
        )}
      </div>
    );
  }

  // Album detail view
  if (selectedAlbum) {
    const approvedPhotos = photos.filter(p => p.status === "aprovado");
    const pendingPhotos = photos.filter(p => p.status === "pendente");
    const myPending = pendingPhotos.filter(p => p.user_id === profile?.user_id);

    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedAlbum(null); setPhotos([]); }}
          className="flex items-center gap-1.5 text-muted-foreground font-inter text-sm hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="rounded-2xl p-4" style={{ background: "var(--gradient-hero)" }}>
          <p className="text-primary-foreground/60 font-inter text-xs mb-1">📸 Álbum do Evento</p>
          <h2 className="font-montserrat font-black text-primary-foreground text-lg">{selectedAlbum.title}</h2>
          <p className="text-primary-foreground/60 font-inter text-xs mt-1">
            📅 {format(new Date(selectedAlbum.event_date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <p className="text-primary-foreground/50 font-inter text-[10px] mt-1">
            {approvedPhotos.length} foto{approvedPhotos.length !== 1 ? "s" : ""} aprovada{approvedPhotos.length !== 1 ? "s" : ""}
            {isLeaderOrAdmin && pendingPhotos.length > 0 && ` · ${pendingPhotos.length} pendente${pendingPhotos.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-2xl text-primary font-montserrat font-bold text-sm hover:bg-primary/15 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <span className="animate-pulse">Enviando...</span>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Enviar Fotos
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />

        {!isLeaderOrAdmin && (
          <p className="text-muted-foreground font-inter text-[10px] text-center -mt-2">
            📋 Suas fotos serão visíveis após aprovação do líder
          </p>
        )}

        {/* Pending moderation (leaders only) */}
        {isLeaderOrAdmin && pendingPhotos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-accent" />
              <span className="font-montserrat font-bold text-foreground text-sm">⏳ Aguardando aprovação ({pendingPhotos.length})</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {pendingPhotos.map(photo => (
                <div key={photo.id} className="relative rounded-xl overflow-hidden border-2 border-accent/30 group">
                  <img
                    src={photo.file_url}
                    alt=""
                    className="w-full aspect-square object-cover"
                    onClick={() => setViewingPhoto(photo)}
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 flex items-center justify-center gap-2 py-1.5">
                    <button
                      onClick={() => handleApprove(photo.id)}
                      className="w-8 h-8 rounded-full bg-brand-green/80 flex items-center justify-center hover:bg-brand-green transition-colors"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => handleReject(photo.id)}
                      className="w-8 h-8 rounded-full bg-destructive/80 flex items-center justify-center hover:bg-destructive transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <p className="absolute top-1 left-1 bg-black/50 text-white text-[9px] font-inter px-1.5 py-0.5 rounded">
                    {photo.user_name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My pending photos (for regular users) */}
        {!isLeaderOrAdmin && myPending.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-montserrat font-bold text-muted-foreground text-xs">Suas fotos pendentes ({myPending.length})</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {myPending.map(photo => (
                <div key={photo.id} className="relative rounded-xl overflow-hidden border border-border opacity-60">
                  <img src={photo.file_url} alt="" className="w-full aspect-square object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-black/40 py-1 text-center">
                    <span className="text-white text-[9px] font-inter">⏳ Pendente</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approved photos grid */}
        {loadingPhotos ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground font-inter text-sm animate-pulse">Carregando fotos...</p>
          </div>
        ) : approvedPhotos.length === 0 ? (
          <div className="text-center py-10">
            <Camera className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-montserrat font-bold text-muted-foreground text-sm">Nenhuma foto aprovada ainda</p>
            <p className="text-muted-foreground font-inter text-xs mt-1">Envie as primeiras fotos deste evento!</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {approvedPhotos.map(photo => (
              <button
                key={photo.id}
                onClick={() => setViewingPhoto(photo)}
                className="relative rounded-xl overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <img
                  src={photo.file_url}
                  alt={photo.caption || ""}
                  className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Album list view
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="w-5 h-5 text-primary" />
        <h3 className="font-montserrat font-black text-foreground text-base">📸 Galeria de Fotos</h3>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <p className="text-muted-foreground font-inter text-sm animate-pulse">Carregando álbuns...</p>
        </div>
      ) : albums.length === 0 ? (
        <div className="text-center py-10">
          <Camera className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-montserrat font-bold text-muted-foreground text-sm">Nenhum álbum disponível</p>
          <p className="text-muted-foreground font-inter text-xs mt-1">Os álbuns aparecerão após os encontros acontecerem.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {albums.map(album => (
            <button
              key={album.id}
              onClick={() => openAlbum(album)}
              className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden text-left hover:shadow-md transition-shadow group focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                {album.cover_url ? (
                  <img
                    src={album.cover_url}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                )}
                {album.photo_count > 0 && (
                  <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-inter px-2 py-0.5 rounded-full">
                    {album.photo_count} 📷
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="font-montserrat font-bold text-foreground text-xs truncate">{album.title}</p>
                <p className="text-muted-foreground font-inter text-[10px] mt-0.5">
                  {format(new Date(album.event_date), "d 'de' MMM yyyy", { locale: ptBR })}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
