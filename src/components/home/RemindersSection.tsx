import { useEffect, useRef, useState } from "react";
import { ChevronDown, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DevotionalReminder from "./DevotionalReminder";
import UpcomingEventReminder from "./UpcomingEventReminder";
import StreakRiskReminder from "./StreakRiskReminder";
import ConversationReminderBanner from "./ConversationReminderBanner";

type Props = {
  onNavigateToDiscipulado: () => void;
  onNavigateToAgenda: () => void;
};

export default function RemindersSection({ onNavigateToDiscipulado, onNavigateToAgenda }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasContent, setHasContent] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (contentRef.current) {
        const childElements = contentRef.current.querySelectorAll('[data-reminder="true"]');
        setHasContent(childElements.length > 0);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!hasContent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-5 mt-2"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 rounded-xl bg-muted/50 border border-border px-4 py-3 hover:bg-muted/80 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-secondary" />
          </div>
          <div className="text-left">
            <p className="font-montserrat font-bold text-foreground text-sm">Lembretes</p>
            <p className="font-inter text-[10px] text-muted-foreground">
              {isOpen ? "Toque para recolher" : "Toque para ver seus avisos"}
            </p>
          </div>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div ref={contentRef} className="pt-2 space-y-0">
              <ConversationReminderBanner />
              <DevotionalReminder onNavigateToDiscipulado={onNavigateToDiscipulado} />
              <UpcomingEventReminder onNavigateToAgenda={onNavigateToAgenda} />
              <StreakRiskReminder onNavigateToJornada={onNavigateToDiscipulado} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
