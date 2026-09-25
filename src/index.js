import React from "react";
import ReactDOM from "react-dom/client";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Sentry from "./sentry";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import "aos/dist/aos.css";
import AOS from "aos";

AOS.init();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center text-slate-700"><div><h1 className="text-xl font-bold">Terjadi kesalahan aplikasi</h1><p className="mt-2 text-sm">Muat ulang halaman atau hubungi administrator jika masalah berlanjut.</p></div></div>}>
      <App />
      <SpeedInsights />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);

reportWebVitals();

// Register the production service worker so the Vercel application can be installed.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.error("PWA service worker registration failed:", error);
    });
  });
}