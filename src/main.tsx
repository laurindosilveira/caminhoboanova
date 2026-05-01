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

// ─── PWA Update Strategy ─────────────────────────────
// Check for updates early and apply them automatically.
// This avoids PWA users staying on an old deployed bundle after a release.

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour (not every 60s)
const VISIBILITY_CHECK_COOLDOWN_MS = 5 * 60 * 1000; // avoid noisy checks when tab focus changes

function showUpdateBanner(updateSWFn: () => void) {
  // Remove any existing banner
  document.getElementById("pwa-update-banner")?.remove();

  const banner = document.createElement("div");
  banner.id = "pwa-update-banner";
  banner.style.cssText = [
    "position:fixed", "bottom:80px", "left:50%", "transform:translateX(-50%)",
    "z-index:99999", "background:#1F3C88", "color:#fff",
    "padding:10px 18px", "border-radius:999px",
    "font-family:Inter,sans-serif", "font-size:13px",
    "box-shadow:0 4px 24px rgba(0,0,0,0.3)",
    "display:flex", "align-items:center", "gap:12px",
    "max-width:calc(100vw - 32px)", "white-space:nowrap",
  ].join(";");
  banner.innerHTML = `
    <span>✨ Nova versão disponível!</span>
    <button id="pwa-update-btn" style="
      background:#E8880A;color:#fff;border:none;border-radius:999px;
      padding:4px 14px;font-size:13px;font-weight:700;cursor:pointer;
    ">Atualizar</button>
  `;
  document.body.appendChild(banner);
  document.getElementById("pwa-update-btn")?.addEventListener("click", () => {
    banner.remove();
    updateSWFn();
  });
  // Auto-hide after 15 seconds if user ignores
  setTimeout(() => banner.remove(), 15000);
}

const updateSW = registerSW({
  immediate: true,

  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    let lastVisibilityCheckAt = 0;

    // Check once on startup
    registration.update();

    // Periodic check — only every 1 hour, not every 60 seconds
    setInterval(() => {
      if (!document.hidden && navigator.onLine) {
        registration.update();
      }
    }, CHECK_INTERVAL_MS);

    // Check when user returns to the app after being away
    document.addEventListener("visibilitychange", () => {
      const now = Date.now();
      if (!document.hidden && navigator.onLine && now - lastVisibilityCheckAt > VISIBILITY_CHECK_COOLDOWN_MS) {
        lastVisibilityCheckAt = now;
        registration.update();
      }
    });
  },

  // When a new version is ready, activate it immediately.
  onNeedRefresh() {
    updateSW(true);
  },

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
