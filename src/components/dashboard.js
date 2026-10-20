import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  Loader2,
  PackageCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import API from "../utils/axiosInstance";

const colors = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#64748b", "#ec4899"];
const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");

const emptyData = {
  inventory: { summary: {}, by_category: [], stock_status: [], low_stock: [], transaction_types: [] },
  sales: { summary: {}, by_day: [], recent_orders: [], payment_methods: [] },
  users: { summary: {}, by_group: [] },
  menu: {},
  master_counts: {},
  purchases: { summary: {} },
};

const Dashboard = ({ onSelectMenu }) => {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const response = await API.get("/dashboard/summary");
        if (!active) return;
        setData(response.data || emptyData);
        setError(null);
      } catch (err) {
        console.error("Gagal memuat dashboard:", err);
        if (active) setError("Gagal memuat data dashboard dari server.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDashboard();
    return () => {
      active = false;
    };
  }, []);

  const report = useMemo(() => {
    const inventory = data.inventory || emptyData.inventory;
    const sales = data.sales || emptyData.sales;
    const users = data.users || emptyData.users;
    const inv = inventory.summary || {};
    const purchase = data.purchases?.summary || {};
    const menu = data.menu || {};
    const master = data.master_counts || {};

    return {
      inventory,
      sales,
      users,
      menu,
      master,
      stats: [
        { label: "Total Item", value: formatNumber(inv.total_items), note: "Produk medis aktif", icon: PackageCheck, tone: "text-emerald-600 bg-emerald-50" },
        { label: "Total Stok", value: formatNumber(inv.total_stok), note: `${formatNumber(inv.total_items)} produk medis aktif`, icon: Boxes, tone: "text-blue-600 bg-blue-50" },
        { label: "Stok Perlu Perhatian", value: formatNumber(inv.stok_rendah), note: "Stok rendah atau kosong", icon: AlertTriangle, tone: "text-amber-600 bg-amber-50" },
        { label: "Pembelian Tertunda", value: formatNumber(purchase.pending_purchases), note: "Perlu ditindaklanjuti", icon: ClipboardList, tone: "text-violet-600 bg-violet-50" },
      ],
    };
  }, [data]);

  const handleOpen = (key) => {
    if (onSelectMenu) onSelectMenu(key);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/72 px-4 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="dashboard-hero relative mb-6 grid overflow-hidden rounded-3xl border border-blue-100/80 bg-gradient-to-br from-white via-blue-50/70 to-teal-50/70 p-6 shadow-sm sm:p-8 lg:min-h-[360px] lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="relative z-10 min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Pusat Operasional Medis</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Ringkasan Operasional Alat Kesehatan</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Pantau persediaan alat kesehatan, transaksi, pengadaan, dan aktivitas tim dalam satu tampilan.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => handleOpen("inventory")} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5">
                <PackageCheck size={17} /> Pengeluaran Barang
              </button>
              <button onClick={() => handleOpen("inventory")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-white/90 px-4 text-sm font-semibold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <Boxes size={17} /> Buka Inventory
              </button>
              <button onClick={() => handleOpen("reports")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <FileText size={17} /> Lihat Report
              </button>
            </div>
          </div>

          <div className="medical-hero-visual pointer-events-none relative z-10 hidden min-h-[300px] w-full items-center justify-center lg:flex" aria-hidden="true">
            <div className="medical-orbit medical-orbit-one"><Stethoscope size={18} /></div>
            <div className="medical-orbit medical-orbit-two"><PackageCheck size={17} /></div>
            <div className="medical-monitor relative w-full max-w-[320px] overflow-hidden rounded-[28px] border border-white/80 bg-white/70 p-5 shadow-2xl shadow-teal-900/15 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="medical-live-dot h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-teal-800">System Healthy</span>
                </div>
                <Activity size={17} className="text-teal-600" />
              </div>

              <div className="mt-5 flex items-center gap-4">
                <div className="medical-heart-wrap relative flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/30">
                  <span className="medical-heart-ring absolute inset-0 rounded-3xl border border-teal-300" />
                  <HeartPulse className="medical-heart" size={38} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Alkes Operations</p>
                  <p className="mt-1 text-xl font-black text-slate-900">Live & Connected</p>
                  <p className="mt-1 text-xs text-slate-500">Inventory · Sales · Procurement</p>
                </div>
              </div>

              <div className="medical-ecg mt-5 h-16 overflow-hidden rounded-2xl border border-teal-100 bg-[#effbf9]">
                <svg className="medical-ecg-track h-full w-[200%]" viewBox="0 0 640 80" preserveAspectRatio="none">
                  <path d="M0 42 H76 L91 42 L104 25 L119 59 L137 8 L157 70 L177 42 H256 L271 42 L284 25 L299 59 L317 8 L337 70 L357 42 H436 L451 42 L464 25 L479 59 L497 8 L517 70 L537 42 H640" fill="none" stroke="url(#ecgGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <defs><linearGradient id="ecgGradient"><stop stopColor="#159895"/><stop offset="1" stopColor="#176b87"/></linearGradient></defs>
                </svg>
                <span className="medical-ecg-scan" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[['24/7', 'Monitoring'], ['6', 'Modules'], ['Live', 'Database']].map(([value, label]) => <div key={label} className="rounded-xl bg-white/85 px-2 py-2 shadow-sm"><p className="text-sm font-black text-teal-700">{value}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p></div>)}
              </div>
            </div>
          </div>
        </div>

        {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {report.stats.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: index * 0.05 }} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{item.label}</p>
                    <p className="mt-3 text-2xl font-bold text-slate-950">{loading ? "..." : item.value}</p>
                  </div>
                  <div className={`medical-kpi-icon flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
                    <Icon size={23} strokeWidth={1.8} />
                  </div>
                </div>
                <p className="mt-4 flex items-center gap-1 text-xs font-medium text-slate-500">
                  <ArrowUpRight size={14} />
                  {item.note}
                </p>
              </motion.div>
            );
          })}
        </div>

        {loading ? (
          <div className="mt-6 flex h-72 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm">
            <Loader2 className="mr-2 animate-spin text-blue-600" size={20} />
            Memuat dashboard live...
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <ChartPanel title="Distribusi Stok per Kategori" subtitle="Bar biru = jumlah item, bar hijau = qty stok." action={() => handleOpen("inventory")}>
                <BarChart rows={report.inventory.by_category} valueKey="item_count" secondaryKey="total_stok" valueFormatter={formatNumber} secondaryFormatter={formatNumber} />
              </ChartPanel>

              <ChartPanel title="Status Ketersediaan Stok" subtitle="Pembagian barang aman, rendah, dan kosong.">
                <PieChart rows={report.inventory.stock_status} />
              </ChartPanel>
            </div>


            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
              <ChartPanel title="Pergerakan Stok 30 Hari" subtitle="Jumlah transaksi inventory berdasarkan tipe.">
                <BarChart rows={report.inventory.transaction_types} valueKey="count" secondaryKey="qty" valueFormatter={formatNumber} secondaryFormatter={formatNumber} />
              </ChartPanel>

              <ChartPanel title="User Per Grup" subtitle="Distribusi user berdasarkan master grup.">
                <PieChart rows={report.users.by_group} />
              </ChartPanel>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6">
              <LowStock rows={report.inventory.low_stock} onOpen={() => handleOpen("stock-opname")} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
              <SystemData menu={report.menu} master={report.master} />
              <Attention total={report.inventory.summary?.stok_rendah} onOpen={() => handleOpen("inventory")} />
            </div>
          </>
        )}
      </section>
    </main>
  );
};

const ChartPanel = ({ title, subtitle, children, action }) => (
  <section className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {action && (
        <button onClick={action} className="shrink-0 rounded-lg border border-blue-100 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50">
          Buka
        </button>
      )}
    </div>
    {children}
  </section>
);

const BarChart = ({ rows = [], valueKey, secondaryKey, valueFormatter, secondaryFormatter }) => {
  const maxValue = Math.max(...rows.map((row) => Math.abs(Number(row[valueKey] || 0))), 1);
  const maxSecondary = Math.max(...rows.map((row) => Math.abs(Number(row[secondaryKey] || 0))), 1);

  if (!rows.length) return <EmptyChart />;

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-2 flex justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{row.label}</p>
              {row.item_count !== undefined && <p className="text-xs text-slate-500">{formatNumber(row.item_count)} item</p>}
            </div>
            <p className="whitespace-nowrap font-bold text-slate-950">{valueFormatter(Number(row[valueKey] || 0))}</p>
          </div>
          <div className="grid grid-cols-[1fr_76px] items-center gap-3">
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="clinical-bar clinical-bar-primary h-full rounded-full" style={{ width: `${Math.max(4, (Math.abs(Number(row[valueKey] || 0)) / maxValue) * 100)}%` }} />
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100" title={secondaryFormatter(Number(row[secondaryKey] || 0))}>
              <div className="clinical-bar clinical-bar-secondary h-full rounded-full" style={{ width: `${Math.max(4, (Math.abs(Number(row[secondaryKey] || 0)) / maxSecondary) * 100)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const PieChart = ({ rows = [] }) => {
  const total = rows.reduce((sum, row) => sum + Number(row.value || row.count || 0), 0);
  let current = 0;
  const gradient = rows.length && total > 0
    ? rows.map((row, index) => {
        const value = Number(row.value || row.count || 0);
        const start = current;
        current += (value / total) * 100;
        return `${colors[index % colors.length]} ${start}% ${current}%`;
      }).join(", ")
    : "#e2e8f0 0% 100%";

  if (!rows.length || total <= 0) return <EmptyChart />;

  return (
    <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[180px_1fr]">
      <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-center text-sm font-bold text-slate-900">
          {formatNumber(total)}
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => {
          const value = Number(row.value || row.count || 0);
          return (
            <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                <span className="truncate font-medium text-slate-700">{row.label || "-"}</span>
              </div>
              <span className="font-bold text-slate-950">{formatNumber(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LowStock = ({ rows, onOpen }) => (
  <section className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Stok Rendah</h2>
        <p className="mt-1 text-sm text-slate-500">Prioritas restock atau stock opname.</p>
      </div>
      <PackageCheck className="text-amber-600" size={24} />
    </div>
    <div className="space-y-3">
      {rows.length ? rows.map((item) => (
        <button key={item.item_id} onClick={onOpen} className="flex w-full items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 text-left hover:bg-amber-50">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{item.nama}</p>
            <p className="mt-1 text-sm text-slate-500">{item.item_id} | {item.kategori}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${Number(item.stok || 0) <= 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{formatNumber(item.stok)} tersisa</span>
        </button>
      )) : <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">Tidak ada item stok rendah.</div>}
    </div>
  </section>
);

const SystemData = ({ menu, master }) => (
  <section className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Data Sistem</h2>
        <p className="mt-1 text-sm text-slate-500">Jumlah master dan menu dari database.</p>
      </div>
      <CheckCircle2 className="text-emerald-600" size={24} />
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MiniStat label="Menu Aktif" value={menu.active_menus} icon={ClipboardList} />
      <MiniStat label="Kategori" value={master.kategori_barang} icon={Boxes} />
      <MiniStat label="Satuan" value={master.satuan_barang} icon={PackageCheck} />
      <MiniStat label="Grup" value={master.grup} icon={UsersRound} />
      <MiniStat label="Departemen" value={master.departemen} icon={ClipboardList} />
      <MiniStat label="Jabatan" value={master.jabatan} icon={ClipboardList} />
      <MiniStat label="Total Menu" value={menu.total_menus} icon={ClipboardList} />
      <MiniStat label="Menu Nonaktif" value={menu.inactive_menus} icon={AlertTriangle} />
    </div>
  </section>
);

const MiniStat = ({ label, value, icon: Icon }) => (
  <div className="rounded-lg border border-slate-200 p-4">
    <Icon className="mb-3 text-blue-600" size={18} />
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-2 text-xl font-bold text-slate-950">{formatNumber(value)}</p>
  </div>
);

const Attention = ({ total, onOpen }) => (
  <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={22} />
        <div>
          <h2 className="font-bold text-amber-950">Perlu Perhatian</h2>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            Ada {formatNumber(total)} item stok rendah atau kosong yang perlu dicek dari Inventory.
          </p>
        </div>
      </div>
      <button onClick={onOpen} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100">Cek</button>
    </div>
  </section>
);

const EmptyChart = () => (
  <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
    Belum ada data.
  </div>
);

export default Dashboard;
