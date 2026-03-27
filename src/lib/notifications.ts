// Notification utility for PWA — uses Service Worker API for Android compatibility

const NOTIFICATION_PERMISSION_KEY = "caminho_notifications_enabled";
const LAST_NOTIFICATION_KEY = "caminho_last_notification";

/**
 * Get the active service worker registration.
 * Returns null if SW is not supported or not ready.
 */
async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;

  if (Notification.permission === "granted") {
    localStorage.setItem(NOTIFICATION_PERMISSION_KEY, "true");
    return true;
  }

  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  const granted = result === "granted";
  localStorage.setItem(NOTIFICATION_PERMISSION_KEY, String(granted));
  return granted;
}

export function isNotificationEnabled(): boolean {
  return (
    localStorage.getItem(NOTIFICATION_PERMISSION_KEY) === "true" &&
    "Notification" in window &&
    Notification.permission === "granted"
  );
}

/**
 * Send a notification via Service Worker (works on Android PWA).
 * Falls back to `new Notification()` only on desktop where SW is unavailable.
 */
export async function sendNotification(
  title: string,
  body: string,
  icon = "/pwa-192x192.png"
) {
  if (!isNotificationEnabled()) return;

  const reg = await getSwRegistration();

  if (reg) {
    // Preferred path — works reliably on Android PWA
    try {
      await reg.showNotification(title, {
        body,
        icon,
        badge: "/pwa-192x192.png",
        tag: "caminho-reminder",
      } as NotificationOptions);
      return;
    } catch (err) {
      console.warn("SW showNotification failed, trying fallback", err);
    }
  }

  // Fallback for desktop / contexts without SW
  try {
    new Notification(title, { body, icon, tag: "caminho-reminder" });
  } catch {
    // silently fail
  }
}

export function scheduleDailyReminder() {
  if (!isNotificationEnabled()) return;

  const now = new Date();
  const target = new Date();
  target.setHours(7, 0, 0, 0); // 7:00 AM

  // If 7 AM already passed today, schedule for tomorrow
  if (now > target) {
    target.setDate(target.getDate() + 1);
  }

  const msUntil = target.getTime() - now.getTime();

  setTimeout(() => {
    const lastNotif = localStorage.getItem(LAST_NOTIFICATION_KEY);
    const today = new Date().toDateString();

    // Only send once per day
    if (lastNotif !== today) {
      sendNotification(
        "📖 Hora do Devocional!",
        "Bom dia! Não esqueça do seu devocional de hoje. Cada dia conta na sua caminhada!"
      );
      localStorage.setItem(LAST_NOTIFICATION_KEY, today);
    }

    // Reschedule for next day
    scheduleDailyReminder();
  }, msUntil);
}
