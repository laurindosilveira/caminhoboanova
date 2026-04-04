import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_TYPES, EventTypeConfig } from "@/config/eventTypes";

export type CustomEventType = {
  id: string;
  value: string;
  label: string;
  emoji: string;
  gives_points: boolean;
  points: number;
  area: string | null;
  created_by: string | null;
};

/**
 * Returns merged list of static + DB-custom event types.
 * If `area` is provided, custom types are filtered to that area (or global ones with area=null).
 */
export function useCustomEventTypes(area?: string) {
  const [customTypes, setCustomTypes] = useState<CustomEventType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [area]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("custom_event_types")
      .select("id, value, label, emoji, gives_points, points, area, created_by")
      .order("created_at");

    const all = (data ?? []) as CustomEventType[];
    // Filter: show global (area=null) + matching area
    const filtered = area
      ? all.filter(t => !t.area || t.area === area)
      : all;
    setCustomTypes(filtered);
    setLoading(false);
  }

  const customAsConfig: EventTypeConfig[] = customTypes.map(t => ({
    value: t.value,
    label: t.label,
    emoji: t.emoji,
    color: "bg-accent/20 text-accent-foreground",
  }));

  const allTypes: EventTypeConfig[] = [...EVENT_TYPES, ...customAsConfig];

  function getLabel(type: string): string {
    return allTypes.find(t => t.value === type)?.label ?? type;
  }

  function getEmoji(type: string): string {
    return allTypes.find(t => t.value === type)?.emoji ?? "📅";
  }

  function getColor(type: string): string {
    return allTypes.find(t => t.value === type)?.color ?? "bg-muted text-muted-foreground";
  }

  return { customTypes, allTypes, loading, getLabel, getEmoji, getColor, refetch: load };
}
