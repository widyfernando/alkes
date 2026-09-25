import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Loader2, RotateCcw, Save, Search } from "lucide-react";
import Swal from "sweetalert2";
import API from "../../utils/axiosInstance";

const num = (value) => Number(value || 0).toLocaleString("id-ID");

const StockOpname = () => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [forms, setForms] = useState({});
  const [showChangedOnly, setShowChangedOnly] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/inventory/items", { params: { search: searchTerm } });
      const rows = response.data.data || [];
      setItems(rows);
      setForms(Object.fromEntries(rows.map((item) => [item.item_id, { stok_fisik: item.stok, catatan: "" }])));
    } catch (err) {
      console.error("Gagal memuat stock opname:", err);
      Swal.fire("Error", "Gagal memuat data stock opname.", "error");
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(fetchItems, 350);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  const updateForm = (itemId, field, value) => {
    setForms((current) => ({ ...current, [itemId]: { ...(current[itemId] || {}), [field]: value } }));
  };

  const changedItems = useMemo(() => {
    return items.filter((item) => {
      const form = forms[item.item_id] || {};
      if (form.stok_fisik === "" || form.stok_fisik === null || form.stok_fisik === undefined) return false;
      return Number(form.stok_fisik) !== Number(item.stok || 0) || String(form.catatan || "").trim();
    });
  }, [forms, items]);

  const visibleItems = useMemo(() => {
    return showChangedOnly ? changedItems : items;
  }, [changedItems, items, showChangedOnly]);

  const totals = useMemo(() => {
    return changedItems.reduce(
      (acc, item) => {
        const form = forms[item.item_id] || {};
        const stokSistem = Number(item.stok || 0);
        const stokFisik = Number(form.stok_fisik || 0);
        const selisih = stokFisik - stokSistem;
        return {
          stokSistem: acc.stokSistem + stokSistem,
          stokFisik: acc.stokFisik + stokFisik,
          selisih: acc.selisih + selisih,
          naik: acc.naik + (selisih > 0 ? 1 : 0),
          turun: acc.turun + (selisih < 0 ? 1 : 0),
        };
      },
      { stokSistem: 0, stokFisik: 0, selisih: 0, naik: 0, turun: 0 }
    );
  }, [changedItems, forms]);

  const resetChanges = () => {
    setForms(Object.fromEntries(items.map((item) => [item.item_id, { stok_fisik: item.stok, catatan: "" }])));
    setShowChangedOnly(false);
  };

  const submit = async (item) => {
    const form = forms[item.item_id] || {};
    const stokFisik = Number(form.stok_fisik);
    if (Number.isNaN(stokFisik) || stokFisik < 0) {
      Swal.fire("Peringatan", `Stok fisik ${item.nama} tidak valid.`, "warning");
      return;
    }

    setSavingId(item.item_id);
    try {
      const response = await API.post("/inventory/stock-opname", {
        item_id: item.item_id,
        stok_fisik: form.stok_fisik,
        catatan: form.catatan,
      });

      if (response.data.status === 1) {
        Swal.fire({ icon: "success", title: "Berhasil", text: response.data.message, timer: 1400, showConfirmButton: false });
        fetchItems();
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal menyimpan stock opname.", "warning");
      }
    } catch (err) {
      console.error("Gagal menyimpan stock opname:", err);
      Swal.fire("Error", err.response?.data?.message || "Gagal menghubungi server.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const submitBulk = async () => {
    if (!changedItems.length) {
      Swal.fire("Peringatan", "Tidak ada perubahan stock opname untuk disimpan.", "warning");
      return;
    }

    const invalid = changedItems.find((item) => {
      const stokFisik = Number(forms[item.item_id]?.stok_fisik);
      return Number.isNaN(stokFisik) || stokFisik < 0;
    });
    if (invalid) {
      Swal.fire("Peringatan", `Stok fisik ${invalid.nama} tidak valid.`, "warning");
      return;
    }

    const confirm = await Swal.fire({
      icon: "question",
      title: "Simpan semua perubahan?",
      text: `${changedItems.length} baris stock opname akan disimpan.`,
      showCancelButton: true,
      confirmButtonText: "Ya, simpan",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;

    setBulkSaving(true);
    try {
      const response = await API.post("/inventory/stock-opname/bulk", {
        items: changedItems.map((item) => ({
          item_id: item.item_id,
          stok_fisik: forms[item.item_id]?.stok_fisik,
          catatan: forms[item.item_id]?.catatan || "",
        })),
      });

      if (response.data.status === 1) {
        Swal.fire({ icon: "success", title: "Berhasil", text: response.data.message, timer: 1600, showConfirmButton: false });
        fetchItems();
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal menyimpan bulk stock opname.", "warning");
      }
    } catch (err) {
      console.error("Gagal menyimpan bulk stock opname:", err);
      Swal.fire("Error", err.response?.data?.message || "Gagal menghubungi server.", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/82 px-4 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600"><ClipboardCheck size={16} /> Inventory Control</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Stock Opname</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Input stok fisik untuk menyesuaikan stok sistem dan mencatat selisihnya ke history.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button onClick={submitBulk} disabled={bulkSaving || loading || !changedItems.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {bulkSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Simpan Semua ({changedItems.length})
            </button>
            <button onClick={resetChanges} disabled={bulkSaving || loading || !changedItems.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              <RotateCcw size={16} />
              Reset
            </button>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Cari barang, SKU, atau locator..." className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <SummaryCard label="Baris berubah" value={changedItems.length} />
          <SummaryCard label="Total selisih" value={num(totals.selisih)} tone={totals.selisih < 0 ? "text-red-600" : totals.selisih > 0 ? "text-emerald-600" : "text-slate-950"} />
          <SummaryCard label="Stok naik" value={totals.naik} tone="text-emerald-600" />
          <SummaryCard label="Stok turun" value={totals.turun} tone="text-red-600" />
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Daftar Opname</h2>
              <p className="mt-1 text-sm text-slate-500">Tampil {visibleItems.length} dari {items.length} barang.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" checked={showChangedOnly} onChange={(event) => setShowChangedOnly(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Hanya tampilkan perubahan
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Barang</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">Stok Sistem</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">Stok Fisik</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Catatan</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="5" className="px-5 py-16 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" /></td></tr>
                ) : visibleItems.length ? visibleItems.map((item) => {
                  const form = forms[item.item_id] || {};
                  const selisih = Number(form.stok_fisik || 0) - Number(item.stok || 0);
                  const isChanged = Number(form.stok_fisik || 0) !== Number(item.stok || 0) || String(form.catatan || "").trim();
                  return (
                    <tr key={item.item_id} className={`hover:bg-blue-50/40 ${isChanged ? "bg-blue-50/30" : ""}`}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950">{item.nama}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.item_id} | {item.satuan || "-"} | {item.kategori || "Tanpa Kategori"}</p>
                        <p className="mt-1 text-xs text-slate-400">Locator: {item.locator || "-"}</p>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-700">{num(item.stok)}</td>
                      <td className="px-5 py-4 text-right"><input type="number" min="0" step="0.01" value={form.stok_fisik ?? ""} onChange={(e) => updateForm(item.item_id, "stok_fisik", e.target.value)} className="h-9 w-28 rounded-lg border px-3 text-right text-sm outline-none focus:ring-2 focus:ring-blue-500" /><p className={`mt-1 text-xs ${selisih === 0 ? "text-slate-400" : selisih > 0 ? "text-emerald-600" : "text-red-600"}`}>Selisih {num(selisih)}</p></td>
                      <td className="px-5 py-4"><input value={form.catatan || ""} onChange={(e) => updateForm(item.item_id, "catatan", e.target.value)} className="h-9 w-full min-w-52 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Catatan opname" /></td>
                      <td className="px-5 py-4 text-right"><button onClick={() => submit(item)} disabled={savingId === item.item_id || bulkSaving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{savingId === item.item_id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan</button></td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="5" className="px-5 py-16 text-center text-sm text-slate-500">{showChangedOnly ? "Belum ada perubahan stock opname." : "Tidak ada barang."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
};

const SummaryCard = ({ label, value, tone = "text-slate-950" }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-sm text-slate-500">{label}</p>
    <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
  </div>
);

export default StockOpname;
