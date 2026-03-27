import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// ─── Splash Screen ────────────────────────────────────
function hideSplash() {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    splash.classList.add("hidden");
    setTimeout(() => splash.remove(), 500);
  }
}

// ─── PWA Auto-Update Strategy ─────────────────────────
// 1. skipWaiting + clientsClaim in SW config → new SW takes over immediately
// 2. Periodic check every 60s while app is visible
// 3. Check on visibility change (user returns to app)
// 4. Check on network reconnection (user was offline)
// 5. Silent reload when update is ready (no user action needed)

const CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

const updateSW = registerSW({
  immediate: true,

  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    // Initial check
    registration.update();

    // Periodic background check while tab is visible
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function startPeriodicCheck() {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (!document.hidden && navigator.onLine) {
          registration.update();
        }
      }, CHECK_INTERVAL_MS);
    }

    function stopPeriodicCheck() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    startPeriodicCheck();

    // Check when user returns to the app (tab/app focus)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && navigator.onLine) {
        registration.update();
        startPeriodicCheck();
      } else {
        stopPeriodicCheck();
      }
    });

    // Check when network comes back online
    window.addEventListener("online", () => {
      registration.update();
    });
  },

  // When a new version is detected, reload transparently
  onNeedRefresh() {
    // If the user is idle or the page is not mid-interaction, reload silently
    // The splash screen will show briefly during reload, so it feels seamless
    window.location.reload();
  },

  // SW registered and controlling the page — nothing extra needed
  onOfflineReady() {
    console.log("[PWA] App pronta para uso offline");
  },
});

// ─── Render App ───────────────────────────────────────
createRoot(document.getElementById("root")!).render(<App />);

// Hide splash after React renders
if (document.readyState === "complete") {
  hideSplash();
} else {
  window.addEventListener("load", () => {
    setTimeout(hideSplash, 300);
  });
}

// Fallback: always hide after 4 seconds
setTimeout(hideSplash, 4000);
