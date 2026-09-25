import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import {
  FaUserCog,
  FaUserLock,
  FaUsers,
  FaBuilding,
  FaBriefcase,
} from "react-icons/fa";
import { Activity, ExternalLink, Loader2, Search, Send, Settings as SettingsIcon, X } from "lucide-react";
import API from "../utils/axiosInstance";
import Sentry from "../sentry";

const menuItems = [
  {
    title: "Master Departemen",
    icon: <FaBuilding size={40} />,
    tone: "border-blue-200 text-blue-700 hover:bg-blue-50",
    desc: "Kelola unit departemen untuk data pengguna.",
    key: "master-departemen",
  },
  {
    title: "Master Jabatan",
    icon: <FaBriefcase size={40} />,
    tone: "border-amber-200 text-amber-700 hover:bg-amber-50",
    desc: "Kelola jabatan dan posisi kerja pengguna.",
    key: "master-jabatan",
  },
  {
    title: "Otoritas Menu Pengguna",
    icon: <FaUserLock size={40} />,
    tone: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    desc: "Kelola hak akses dan pengguna sistem.",
    key: "otoritas",
  },
  {
    title: "Pengaturan Pengguna",
    icon: <FaUserCog size={40} />,
    tone: "border-violet-200 text-violet-700 hover:bg-violet-50",
    desc: "Kelola profil dan password akun yang sedang login.",
    key: "pengaturan-pengguna",
  },
  {
    title: "Master Grup Pengguna",
    icon: <FaUsers size={40} />,
    tone: "border-cyan-200 text-cyan-700 hover:bg-cyan-50",
    desc: "Kelola pengelompokan dan tingkatan hak akses pengguna.",
    key: "master-group",
  },
  {
    title: "Master Users",
    icon: <FaUsers size={40} />,
    tone: "border-rose-200 text-rose-700 hover:bg-rose-50",
    desc: "Kelola semua user: tambah, edit, dan nonaktifkan akun.",
    key: "master-users",
  },
];

const Settings = ({ onSelectMenu, allowedPages }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [monitoring, setMonitoring] = useState({ backend: false, environment: "-" });
  const [monitoringLoading, setMonitoringLoading] = useState(true);
  const [testingTarget, setTestingTarget] = useState("");
  const frontendSentryEnabled = Boolean(process.env.REACT_APP_SENTRY_DSN);

  useEffect(() => {
    API.get("/monitoring/status")
      .then((response) => setMonitoring(response.data.data || { backend: false, environment: "-" }))
      .catch(() => setMonitoring({ backend: false, environment: "tidak tersedia" }))
      .finally(() => setMonitoringLoading(false));
  }, []);

  const testSentry = async (target) => {
    setTestingTarget(target);
    try {
      let eventId;
      if (target === "frontend") {
        if (!frontendSentryEnabled) throw new Error("REACT_APP_SENTRY_DSN frontend belum dikonfigurasi");
        eventId = Sentry.captureMessage("Alkes frontend test event", "info");
        await Sentry.flush(2000);
      } else {
        const response = await API.post("/monitoring/test-event");
        if (response.data.status !== 1) throw new Error(response.data.message);
        eventId = response.data.event_id;
      }
      await Swal.fire({ icon: "success", title: "Event Terkirim", text: `Cek menu Issues di Sentry. Event ID: ${eventId || "diproses"}`, confirmButtonColor: "#2563eb" });
    } catch (error) {
      Swal.fire("Monitoring Belum Aktif", error.message || "Event uji gagal dikirim.", "warning");
    } finally {
      setTestingTarget("");
    }
  };

  const filteredItems = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    const permitted = allowedPages ? menuItems.filter((item) => allowedPages.has(item.key)) : menuItems;
    if (!keyword) return permitted;

    return permitted.filter((item) =>
      `${item.title} ${item.desc}`.toLowerCase().includes(keyword)
    );
  }, [allowedPages, searchTerm]);

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/72 px-4 py-8 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:px-6 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
              <SettingsIcon size={16} />
              System Settings
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Settings</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Pilih menu pengaturan sistem yang ingin dikelola.
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Cari menu settings..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Hapus pencarian"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredItems.map((item, index) => (
            <motion.button
              key={item.key}
              type="button"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
              whileHover={{ scale: 1.06, y: -4 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelectMenu(item.key)}
              className={`group relative h-36 overflow-hidden rounded-lg border bg-white p-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${item.tone}`}
            >
              <div className="flex h-full flex-col items-center justify-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-50 shadow-sm transition group-hover:bg-white">
                  {item.icon}
                </div>
                <p className="text-sm font-bold leading-5 text-slate-950">{item.title}</p>
              </div>

              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-white/95 px-4 text-center opacity-0 transition-all duration-300 hover:opacity-100">
                <p className="text-sm leading-relaxed text-slate-700">{item.desc}</p>
              </div>
            </motion.button>
          ))}

          {filteredItems.length === 0 && (
            <div className="col-span-full flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center text-slate-500 shadow-sm">
              <SettingsIcon className="mb-3 text-slate-300" size={36} />
              <p className="text-sm font-semibold">Menu settings tidak ditemukan</p>
              <p className="mt-1 text-sm">Ubah kata kunci pencarian.</p>
            </div>
          )}
        </div>

        <section className="mt-8 overflow-hidden rounded-2xl border border-blue-100 bg-white/88 shadow-lg shadow-blue-900/5 backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="flex items-center gap-2 font-bold text-slate-900"><Activity size={18} className="text-blue-600" /> Monitoring Sentry</h2><p className="mt-1 text-sm text-slate-500">Status error monitoring frontend dan backend.</p></div>
            <a href={process.env.REACT_APP_SENTRY_ISSUES_URL || "https://sentry.io/issues/"} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800">Buka Issues <ExternalLink size={14} /></a>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {[
              { key: "frontend", label: "Frontend React", enabled: frontendSentryEnabled, environment: process.env.REACT_APP_SENTRY_ENVIRONMENT || process.env.NODE_ENV },
              { key: "backend", label: "Backend Express", enabled: monitoring.backend, environment: monitoring.environment },
            ].map((item) => (
              <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{item.label}</p><p className="mt-1 text-xs text-slate-500">Environment: {item.environment || "-"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.enabled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{monitoringLoading && item.key === "backend" ? "Memeriksa" : item.enabled ? "Aktif" : "Belum aktif"}</span></div>
                <button type="button" onClick={() => testSentry(item.key)} disabled={!item.enabled || Boolean(testingTarget)} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-blue-100 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">{testingTarget === item.key ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kirim Event Uji</button>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
};

export default Settings;
