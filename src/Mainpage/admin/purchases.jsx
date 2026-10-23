import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Eye, Loader2, PackageCheck, Plus, Printer, Search, Trash2, X } from "lucide-react";
import Swal from "sweetalert2";
import API from "../../utils/axiosInstance";

const money = (value) => "Rp " + Number(value || 0).toLocaleString("id-ID");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const emptyForm = () => ({ supplier_name: "", invoice_number: "", spb_number: "", po_number: "", purchase_date: new Date().toISOString().slice(0, 10), notes: "", items: [{ item_id: "", qty: 1, unit_cost: 0, serial_number: "" }] });

export default function Purchases() {
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [brandFilter, setBrandFilter] = useState("all");
  const brands = useMemo(() => [...new Set(items.map((item) => String(item.merek || "").trim() || "Tanpa Brand"))].sort(), [items]);
  const selectableItems = useMemo(() => brandFilter === "all" ? items : items.filter((item) => (String(item.merek || "").trim() || "Tanpa Brand") === brandFilter), [brandFilter, items]);

  const load = useCallback(async () => {
    const response = await API.get("/purchases", { params: { search, page } });
    setRows(response.data.data || []);
    setPages(Number(response.data.total_pages || 1));
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(() => load().catch(() => Swal.fire("Error", "Gagal memuat pembelian", "error")), 200);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    API.get("/inventory/items", { params: { limit: 5000, sort: "name" } }).then((response) => setItems(response.data.data || []));
  }, []);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = async (id) => {
    setLoadingEdit(true);
    try {
      const response = await API.get(`/purchases/${id}`);
      const data = response.data.data;
      setForm({
        supplier_name: data.supplier_name || "",
        invoice_number: data.invoice_number || "",
        spb_number: data.spb_number || "",
        po_number: data.po_number || "",
        purchase_date: String(data.purchase_date || "").slice(0, 10),
        notes: data.notes || "",
        items: (data.items || []).map((item) => ({ item_id: item.item_id, qty: item.qty, unit_cost: item.unit_cost, serial_number: item.serial_number || "" })),
      });
      setEditingId(id);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      Swal.fire("Gagal", error.response?.data?.message || "Detail pembelian gagal dimuat", "error");
    } finally {
      setLoadingEdit(false);
    }
  };

  const updateLine = (index, key, value) => setForm((current) => ({
    ...current,
    items: current.items.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line),
  }));

  const removeLine = (index) => setForm((current) => ({
    ...current,
    items: current.items.length === 1 ? current.items : current.items.filter((_, lineIndex) => lineIndex !== index),
  }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = editingId
        ? await API.put(`/purchases/${editingId}`, form)
        : await API.post("/purchases", form);
      await Swal.fire({ icon: "success", title: "Berhasil", text: response.data.message, timer: 1600, showConfirmButton: false });
      closeForm();
      setPage(1);
      load();
    } catch (error) {
      Swal.fire("Gagal", error.response?.data?.message || "Pembelian gagal disimpan", "error");
    } finally {
      setSaving(false);
    }
  };

  const removePurchase = async (row) => {
    const confirmation = await Swal.fire({
      icon: "warning",
      title: `Hapus ${row.purchase_id}?`,
      text: "Draft beserta seluruh detail item akan dihapus permanen.",
      showCancelButton: true,
      confirmButtonText: "Hapus Draft",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmation.isConfirmed) return;
    try {
      const response = await API.delete(`/purchases/${row.purchase_id}`);
      await Swal.fire({ icon: "success", title: "Terhapus", text: response.data.message, timer: 1500, showConfirmButton: false });
      if (editingId === row.purchase_id) closeForm();
      load();
    } catch (error) {
      Swal.fire("Gagal", error.response?.data?.message || "Pembelian gagal dihapus", "error");
    }
  };

  const viewDetail = async (id) => {
    try {
      const response = await API.get("/purchases/" + id);
      const data = response.data.data || {};
      const itemRows = (data.items || []).map((item) => "<tr><td style='padding:6px;border:1px solid #ddd'>" + item.item_id + " - " + item.nama + "</td><td style='padding:6px;border:1px solid #ddd'>" + (item.serial_number || "-") + "</td><td style='padding:6px;border:1px solid #ddd;text-align:right'>" + Number(item.qty).toLocaleString("id-ID") + "</td><td style='padding:6px;border:1px solid #ddd;text-align:right'>" + money(item.unit_cost) + "</td></tr>").join("");
      await Swal.fire({ title: "Detail " + id, width: 760, html: "<div style='text-align:left'><p><b>SPB:</b> " + (data.spb_number || "-") + " &nbsp; <b>PO:</b> " + (data.po_number || "-") + "</p><p><b>Supplier:</b> " + data.supplier_name + "</p><table style='width:100%;border-collapse:collapse;margin-top:12px'><thead><tr><th style='padding:6px;border:1px solid #ddd'>Barang</th><th style='padding:6px;border:1px solid #ddd'>SN/Batch</th><th style='padding:6px;border:1px solid #ddd'>Qty</th><th style='padding:6px;border:1px solid #ddd'>Harga</th></tr></thead><tbody>" + itemRows + "</tbody></table></div>" });
    } catch (error) {
      Swal.fire("Gagal", error.response?.data?.message || "Detail SPB gagal dimuat", "error");
    }
  };

  const printPurchase = async (id) => {
    try {
      const response = await API.get(`/purchases/${id}`);
      const data = response.data.data || {};
      const rowsHtml = (data.items || []).map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.item_id)}</td><td>${escapeHtml(item.nama)}</td><td>${escapeHtml(item.merek || "-")}</td><td>${escapeHtml(item.serial_number || "-")}</td><td class="number">${Number(item.qty || 0).toLocaleString("id-ID")}</td><td class="number">${money(item.unit_cost)}</td><td class="number">${money(Number(item.qty || 0) * Number(item.unit_cost || 0))}</td></tr>`).join("");
      const printWindow = window.open("", "_blank", "width=1000,height=800");
      if (!printWindow) return Swal.fire("Pop-up diblokir", "Izinkan pop-up untuk mencetak draft pembelian.", "warning");
      printWindow.document.write(`<html><head><meta charset="utf-8"><title>Pembelian ${escapeHtml(data.purchase_id)}</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;font-size:9pt}.header{text-align:center;border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:14px}.header img{width:145px;max-height:55px;object-fit:contain}.header h1{font-size:16pt;margin:8px 0 2px}.company{font-size:10pt}.status{display:inline-block;margin-top:6px;border:1px solid #555;padding:3px 10px;font-weight:bold}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:14px}.box{border:1px solid #555;padding:7px;min-height:32px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #333;padding:5px}th{background:#eee;text-align:center}.number{text-align:right}.notes{margin-top:12px;border:1px solid #555;padding:8px;min-height:45px}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:25px;margin-top:28px;text-align:center}.space{height:55px}.footer{border-top:1px solid #777;margin-top:22px;padding-top:6px;font-size:8pt}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="header"><img src="${window.location.origin}/logo-panamed.png" alt="Panamed"><h1>DRAFT PEMBELIAN BARANG</h1><div class="company">PT. Panamed Anugerah Abadi</div><div class="status">${escapeHtml(data.status || "DRAFT")}</div></div><div class="meta"><div class="box"><b>Nomor:</b> ${escapeHtml(data.purchase_id)}</div><div class="box"><b>Tanggal:</b> ${escapeHtml(String(data.purchase_date || "").slice(0,10))}</div><div class="box"><b>Supplier:</b> ${escapeHtml(data.supplier_name)}</div><div class="box"><b>No. PO:</b> ${escapeHtml(data.po_number || "-")}</div><div class="box"><b>No. SPB:</b> ${escapeHtml(data.spb_number || "-")}</div><div class="box"><b>No. Faktur:</b> ${escapeHtml(data.invoice_number || "-")}</div></div><table><thead><tr><th>No</th><th>Kode</th><th>Barang</th><th>Brand</th><th>SN/Batch</th><th>Qty</th><th>Harga</th><th>Jumlah</th></tr></thead><tbody>${rowsHtml}</tbody><tfoot><tr><th colspan="7" class="number">TOTAL</th><th class="number">${money(data.total)}</th></tr></tfoot></table><div class="notes"><b>Catatan:</b><br>${escapeHtml(data.notes || "-")}</div><div class="sign"><div>Dibuat oleh<div class="space"></div>(___________________)</div><div>Diperiksa<div class="space"></div>(___________________)</div><div>Disetujui<div class="space"></div>(___________________)</div></div><div class="footer">Tanggal cetak: ${new Date().toLocaleString("id-ID")}</div></body></html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    } catch (error) {
      Swal.fire("Gagal", error.response?.data?.message || "Dokumen pembelian tidak dapat dicetak", "error");
    }
  };

  const receive = async (id) => {
    const confirmation = await Swal.fire({ icon: "question", title: "Terima barang?", text: "Stok akan langsung bertambah dan pembelian tidak dapat diedit lagi.", showCancelButton: true, confirmButtonText: "Terima" });
    if (!confirmation.isConfirmed) return;
    try {
      const response = await API.post(`/purchases/${id}/receive`);
      await Swal.fire("Berhasil", response.data.message, "success");
      if (editingId === id) closeForm();
      load();
    } catch (error) {
      Swal.fire("Gagal", error.response?.data?.message || "Penerimaan gagal", "error");
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl bg-white/90 p-4 shadow-xl sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-bold uppercase text-blue-600">Procurement</p><h1 className="text-3xl font-bold">Pembelian Barang</h1><p className="text-sm text-slate-500">Pembelian supplier dan penerimaan stok alat kesehatan.</p></div>
          <button onClick={showForm ? closeForm : openCreate} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">
            {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Tutup Form" : "Pembelian Baru"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={save} className="mb-6 space-y-4 rounded-xl border border-teal-100 bg-slate-50 p-5 shadow-sm">
            <div className="flex items-center justify-between"><div><p className="font-bold text-slate-900">{editingId ? `Edit ${editingId}` : "Draft Pembelian Baru"}</p><p className="text-xs text-slate-500">Hanya draft yang dapat diedit.</p></div>{editingId && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">DRAFT</span>}</div>
            <div className="grid gap-3 md:grid-cols-5">
              <input aria-label="Supplier" required placeholder="Supplier" value={form.supplier_name} onChange={(event) => setForm({ ...form, supplier_name: event.target.value })} className="rounded-lg border p-2" />
              <input aria-label="Nomor SPB" required placeholder="Nomor SPB, contoh SPB 001" value={form.spb_number} onChange={(event) => setForm({ ...form, spb_number: event.target.value })} className="rounded-lg border p-2" />
              <input aria-label="Nomor PO" placeholder="Nomor PO" value={form.po_number} onChange={(event) => setForm({ ...form, po_number: event.target.value })} className="rounded-lg border p-2" />
              <input aria-label="Nomor faktur" placeholder="Nomor faktur" value={form.invoice_number} onChange={(event) => setForm({ ...form, invoice_number: event.target.value })} className="rounded-lg border p-2" />
              <input aria-label="Tanggal pembelian" required type="date" value={form.purchase_date} onChange={(event) => setForm({ ...form, purchase_date: event.target.value })} className="rounded-lg border p-2" />
            </div>
            <textarea aria-label="Catatan" placeholder="Catatan pembelian" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-20 w-full rounded-lg border p-2" />
            <div className="space-y-2">
              <div className="flex items-center gap-2"><label className="text-xs font-bold uppercase text-slate-500">Filter Brand</label><select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm"><option value="all">Semua Brand</option>{brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select></div>
              {form.items.map((line, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[1fr_150px_100px_160px_42px]">
                  <select aria-label={`Barang baris ${index + 1}`} required value={line.item_id} onChange={(event) => updateLine(index, "item_id", event.target.value)} className="w-full rounded-lg border bg-white p-2">
                    <option value="">Pilih barang</option>
                    {selectableItems.map((item) => <option key={item.item_id} value={item.item_id}>{item.nama} ({item.item_id}) · {item.merek || "Tanpa Brand"}</option>)}
                  </select>
                  <input aria-label={`SN batch baris ${index + 1}`} placeholder="SN / Batch" value={line.serial_number || ""} onChange={(event) => updateLine(index, "serial_number", event.target.value)} className="rounded-lg border p-2" />
                  <input aria-label={`Jumlah baris ${index + 1}`} required min="0.01" step="0.01" type="number" value={line.qty} onChange={(event) => updateLine(index, "qty", event.target.value)} className="rounded-lg border p-2" />
                  <input aria-label={`Harga beli baris ${index + 1}`} required min="0" step="0.01" type="number" value={line.unit_cost} onChange={(event) => updateLine(index, "unit_cost", event.target.value)} className="rounded-lg border p-2" />
                  <button type="button" onClick={() => removeLine(index)} disabled={form.items.length === 1} aria-label="Hapus item" className="flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { item_id: "", qty: 1, unit_cost: 0, serial_number: "" }] })} className="font-bold text-blue-600">+ Tambah Item</button>
              <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 font-bold text-white disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />}{editingId ? "Simpan Perubahan" : "Simpan Draft"}</button>
            </div>
          </form>
        )}

        <div className="relative mb-3 max-w-sm"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari nomor, SPB, PO, faktur, supplier" className="w-full rounded-lg border py-2 pl-9 pr-3" /></div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full divide-y text-sm">
            <thead className="bg-slate-50"><tr>{["Nomor", "Tanggal", "Supplier", "Item", "Total", "Status", "Aksi"].map((label) => <th key={label} className="p-3 text-left text-xs uppercase text-slate-500">{label}</th>)}</tr></thead>
            <tbody className="divide-y">
              {rows.length ? rows.map((row) => (
                <tr key={row.purchase_id}>
                  <td className="p-3 font-mono font-bold">{row.spb_number || row.purchase_id}<p className="mt-1 text-[10px] font-normal text-slate-400">PO: {row.po_number || "-"} | {row.purchase_id}</p></td>
                  <td className="p-3">{String(row.purchase_date).slice(0, 10)}</td><td className="p-3">{row.supplier_name}</td><td className="p-3">{row.item_count}</td><td className="p-3 font-bold">{money(row.total)}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.status === "DRAFT" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{row.status}</span></td>
                  <td className="p-3"><div className="flex flex-wrap gap-1.5"><button onClick={() => viewDetail(row.purchase_id)} className="flex items-center gap-1 rounded border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700"><Eye size={14} /> Detail</button><button onClick={() => printPurchase(row.purchase_id)} className="flex items-center gap-1 rounded border border-violet-200 px-2.5 py-2 text-xs font-bold text-violet-700"><Printer size={14} /> Print</button>{row.status === "DRAFT" && <><button onClick={() => openEdit(row.purchase_id)} disabled={loadingEdit} className="flex items-center gap-1 rounded border border-blue-200 px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"><Edit3 size={14} /> Edit</button><button onClick={() => removePurchase(row)} className="flex items-center gap-1 rounded border border-red-200 px-2.5 py-2 text-xs font-bold text-red-700 hover:bg-red-50"><Trash2 size={14} /> Hapus</button><button onClick={() => receive(row.purchase_id)} className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><PackageCheck size={14} /> Terima</button></>}</div></td>
                </tr>
              )) : <tr><td colSpan="7" className="p-12 text-center text-slate-500">Belum ada data pembelian.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end gap-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-2 disabled:opacity-40">Sebelumnya</button><span className="p-2">{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-2 disabled:opacity-40">Berikutnya</button></div>
      </div>
    </main>
  );
}
