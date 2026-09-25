import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DatabaseBackup, Download, FileText, Loader2, Search } from "lucide-react";
import API from "../../utils/axiosInstance";

const reportTypes = [
  { key: "stock", label: "Report Stok" },
  { key: "restock", label: "Report Restock" },
  { key: "opname", label: "Report Opname" },
  { key: "movement", label: "Barang Masuk/Keluar" },
  { key: "sales", label: "Report Penjualan" },
];

const formatValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toLocaleString("id-ID");
  return String(value);
};

const toDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const Reports = () => {
  const [type, setType] = useState("stock");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tipe, setTipe] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get(`/reports/${type}`, {
        params: {
          search,
          status,
          tipe,
          start_date: startDate,
          end_date: endDate,
        },
      });
      setRows(response.data.data || []);
    } catch (error) {
      console.error("Gagal memuat report:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [endDate, search, startDate, status, tipe, type]);

  useEffect(() => {
    const timer = setTimeout(fetchReport, 250);
    return () => clearTimeout(timer);
  }, [fetchReport]);

  const columns = useMemo(() => {
    const keys = rows[0] ? Object.keys(rows[0]) : defaultColumns(type);
    return keys;
  }, [rows, type]);

  const summary = useMemo(() => {
    const sum = (key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
    if (type === "sales") {
      const completed = rows.filter((row) => row.status !== "BATAL");
      const completedSum = (key) => completed.reduce((total, row) => total + Number(row[key] || 0), 0);
      return [{ label: "Transaksi Selesai", value: completed.length.toLocaleString("id-ID") }, { label: "Omzet Bersih", value: `Rp ${completedSum("total").toLocaleString("id-ID")}` }, { label: "Transaksi Batal", value: (rows.length - completed.length).toLocaleString("id-ID") }];
    }
    if (type === "stock") return [{ label: "Total Barang", value: rows.length.toLocaleString("id-ID") }, { label: "Total Stok", value: sum("stok").toLocaleString("id-ID") }, { label: "Nilai Jual", value: `Rp ${sum("nilai_jual").toLocaleString("id-ID")}` }];
    return [{ label: "Total Baris", value: rows.length.toLocaleString("id-ID") }, { label: "Total Qty", value: sum("qty").toLocaleString("id-ID") }, { label: "Jenis Report", value: reportTypes.find((item) => item.key === type)?.label || type }];
  }, [rows, type]);

  const applyPeriod = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setStartDate(toDateInput(start));
    setEndDate(toDateInput(end));
  };

  const exportCsv = () => {
    const header = columns.join(",");
    const body = rows.map((row) => columns.map((column) => `"${formatValue(row[column]).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const header = columns.map((column) => `<th>${column.replaceAll("_", " ")}</th>`).join("");
    const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${formatValue(row[column])}</td>`).join("")}</tr>`).join("");
    const html = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadBackup = async () => {
    const response = await API.get("/backup");
    const blob = new Blob([JSON.stringify(response.data.backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/68 px-4 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-md sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/90 bg-gradient-to-r from-white/85 via-blue-50/70 to-cyan-50/60 p-5 shadow-sm backdrop-blur-lg lg:flex-row lg:items-end lg:justify-between sm:p-6">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600"><FileText size={16} /> Report</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Laporan Operasional</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Tarik report stok, restock, opname, pergerakan barang, dan penjualan dari database.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={downloadBackup} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              <DatabaseBackup size={17} />
              Backup JSON
            </button>
            <button onClick={exportExcel} disabled={!rows.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={17} />
              Export Excel
            </button>
            <button onClick={exportCsv} disabled={!rows.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={17} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {summary.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/90 bg-white/82 p-4 shadow-sm backdrop-blur-lg">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
              <p className="mt-2 truncate text-xl font-extrabold text-slate-900">{loading ? "..." : item.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 overflow-x-auto rounded-2xl border border-white/90 bg-white/78 p-2 shadow-sm backdrop-blur-lg">
          <div className="flex min-w-max gap-2">
            {reportTypes.map((item) => (
              <button key={item.key} onClick={() => setType(item.key)} className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${type === item.key ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-white/90 bg-white/82 p-4 shadow-sm backdrop-blur-lg md:grid-cols-5">
          {(type === "movement" || type === "opname" || type === "sales") && (
            <div className="flex flex-wrap gap-2 md:col-span-5">
              <span className="mr-1 self-center text-xs font-bold uppercase tracking-wide text-slate-400">Periode cepat</span>
              <button type="button" onClick={() => applyPeriod(1)} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">Hari Ini</button>
              <button type="button" onClick={() => applyPeriod(7)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-700">7 Hari</button>
              <button type="button" onClick={() => applyPeriod(30)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-700">30 Hari</button>
              <button type="button" onClick={() => { const now = new Date(); setStartDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`); setEndDate(toDateInput(now)); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-700">Bulan Ini</button>
            </div>
          )}
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari report..." className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {(type === "stock") && (
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Semua Status</option>
              <option value="Aman">Aman</option>
              <option value="Mau Habis">Mau Habis</option>
              <option value="Kosong">Kosong</option>
            </select>
          )}
          {(type === "movement" || type === "opname" || type === "sales") && (
            <>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </>
          )}
          {type === "movement" && (
            <select value={tipe} onChange={(event) => setTipe(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Semua Tipe</option>
              <option value="MASUK">MASUK</option>
              <option value="KELUAR">KELUAR</option>
              <option value="OPNAME">OPNAME</option>
              <option value="RETUR">RETUR</option>
            </select>
          )}
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/90 bg-white/90 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/60 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">{reportTypes.find((item) => item.key === type)?.label}</h2>
            <p className="mt-1 text-sm text-slate-500">Total {rows.length} baris.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">{column.replaceAll("_", " ")}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={Math.max(columns.length, 1)} className="px-5 py-16 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" /></td></tr>
                ) : rows.length ? rows.map((row, index) => (
                  <tr key={row.id || row.item_id || row.sales_id || row.transaksi_id || index} className="hover:bg-blue-50/30">
                    {columns.map((column) => <td key={column} className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">{formatValue(row[column])}</td>)}
                  </tr>
                )) : (
                  <tr><td colSpan={Math.max(columns.length, 1)} className="px-5 py-16 text-center text-sm text-slate-500">Tidak ada data report.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
};

const defaultColumns = (type) => {
  if (type === "sales") return ["sales_id", "created_at", "metode_pembayaran", "total", "status", "items"];
  if (type === "movement" || type === "opname") return ["transaksi_id", "created_at", "item_id", "nama", "tipe", "qty", "stok_sebelum", "stok_sesudah", "catatan"];
  if (type === "restock") return ["item_id", "nama", "kategori", "stok", "minimum_stock", "rekomendasi_restock"];
  return ["item_id", "nama", "kategori", "stok", "minimum_stock", "status_stok", "nilai_modal", "nilai_jual"];
};

export default Reports;
