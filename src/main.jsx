import "./utils/safeStorage.js";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Clean up any stale dev-sw.js / sw.js registrations so only /audio-sw.js controls the scope without reload loops
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations?.().then((regs) => {
    for (const reg of regs) {
      const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
      if (scriptURL && !scriptURL.includes("audio-sw.js")) {
        reg.unregister().catch(() => {});
      }
    }
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);