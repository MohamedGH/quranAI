import "./utils/safeStorage.js";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Clean up any stale service workers and old caches so updates load immediately
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const isDevHost = window.location.hostname.includes("ais-dev") ||
                    window.location.hostname === "localhost" ||
                    window.location.hostname === "127.0.0.1";
  if (isDevHost) {
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.forEach((r) => r.unregister().catch(() => {}));
    }).catch(() => {});
    if ("caches" in window) {
      caches.keys?.().then((keys) => {
        keys.forEach((k) => caches.delete(k).catch(() => {}));
      }).catch(() => {});
    }
  } else {
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      for (const reg of regs) {
        const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
        if (scriptURL && !scriptURL.includes("audio-sw.js")) {
          reg.unregister().catch(() => {});
        } else {
          reg.update().catch(() => {});
        }
      }
    }).catch(() => {});
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);