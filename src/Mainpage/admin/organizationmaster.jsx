import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, BriefcaseBusiness, ChevronLeft, ChevronRight, Edit, Loader2, Plus, Save, Search, X } from "lucide-react";
import Swal from "sweetalert2";
import API from "../../utils/axiosInstance";

const PAGE_SIZE = 8;

const OrganizationMaster = ({ type, onClose }) => {
  const isDepartment = type === "departemen";
  const config = isDepartment
    ? { title: "Master Departemen", singular: "Departemen", endpoint: "/departemen", detail: "/detail_departemen", idKey: "departemen_id", queryKey: "dept_id", icon: Building2 }
    : { title: "Master Jabatan", singular: "Jabatan", endpoint: "/jabatan", detail: "/detail_jabatan", idKey: "jabatan_id", queryKey: "jabatan_id", icon: BriefcaseBusiness };
  const Icon = config.icon;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalMode, setModalMode] = useState(null);
  const [form, setForm] = useState({ id: "", nama: "" });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get(config.endpoint);
      if (response.data.status !== 1) throw new Error(response.data.message || "Data tidak dapat dimuat");
      setItems(response.data.data || []);
    } catch (error) {
      Swal.fire("Gagal Memuat Data", error.response?.data?.message || error.message || "Server tidak dapat dihubungi.", "error");
    } finally {
      setLoading(false);
    }
  }, [config.endpoint]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { setPage(1); }, [search]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword ? items.filter((item) => `${item[config.idKey]} ${item.nama}`.toLowerCase().includes(keyword)) : items;
  }, [config.idKey, items, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const openAdd = () => { setForm({ id: "", nama: "" }); setModalMode("add"); };
  const openEdit = async (item) => {
    setSaving(true);
    try {
      const response = await API.get(config.detail, { params: { [config.queryKey]: item[config.idKey] } });
      const detail = response.data[type];
      if (response.data.status !== 1 || !detail) throw new Error(response.data.message || "Data tidak ditemukan");
      setForm({ id: detail[config.idKey], nama: detail.nama || "" });
      setModalMode("edit");
    } catch (error) {
      Swal.fire("Gagal Memuat Detail", error.response?.data?.message || error.message, "error");
    } finally { setSaving(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    const nama = form.nama.trim();
    if (!nama) return;
    setSaving(true);
    try {
      const response = modalMode === "edit"
        ? await API.put(config.endpoint, { nama }, { params: { [config.queryKey]: form.id } })
        : await API.post(config.endpoint, { nama });
      if (response.data.status !== 1) throw new Error(response.data.message || "Data gagal disimpan");
      setModalMode(null);
      await Swal.fire({ icon: "success", title: "Berhasil", text: response.data.message, timer: 1500, showConfirmButton: false });
      fetchItems();
    } catch (error) {
      Swal.fire("Gagal Menyimpan", error.response?.data?.message || error.message || "Server tidak dapat dihubungi.", "error");
    } finally { setSaving(false); }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/75 px-4 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600"><Icon size={16} /> Organization Master</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{config.title}</h1>
            <p className="mt-2 text-sm text-slate-500">Kelola data {config.singular.toLowerCase()} yang digunakan pada profil dan akun pengguna.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={openAdd} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Plus size={17} />Tambah {config.singular}</button>
            <button onClick={() => onClose?.("settings")} aria-label="Tutup" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600"><X size={19} /></button>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-white/90 bg-white/80 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-bold text-slate-950">Daftar {config.singular}</h2><p className="mt-1 text-sm text-slate-500">{filtered.length} data ditemukan.</p></div>
            <div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Cari ${config.singular.toLowerCase()}...`} className="h-10 w-full rounded-lg border border-slate-200 bg-white/90 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50/80"><tr><th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Kode</th><th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Nama {config.singular}</th><th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">Aksi</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan="3" className="px-5 py-16 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" /></td></tr> : visibleItems.length ? visibleItems.map((item) => (
                  <tr key={item[config.idKey]} className="hover:bg-blue-50/50"><td className="px-5 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{item[config.idKey]}</span></td><td className="px-5 py-4 text-sm font-semibold text-slate-950">{item.nama}</td><td className="px-5 py-4 text-right"><button onClick={() => openEdit(item)} aria-label={`Edit ${item.nama}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50"><Edit size={15} /></button></td></tr>
                )) : <tr><td colSpan="3" className="px-5 py-16 text-center text-sm text-slate-500">Belum ada data {config.singular.toLowerCase()}.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 text-sm text-slate-500"><span>Halaman {page} dari {pageCount}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
        </section>
      </section>

      {modalMode && <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-2xl"><div className="flex items-center justify-between border-b bg-slate-50/80 px-6 py-4"><div><h3 className="font-bold text-slate-900">{modalMode === "edit" ? "Edit" : "Tambah"} {config.singular}</h3>{form.id && <p className="mt-1 font-mono text-xs text-slate-400">{form.id}</p>}</div><button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-red-500"><X size={20} /></button></div><form onSubmit={submit} className="space-y-5 p-6"><div><label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Nama {config.singular}</label><input autoFocus required maxLength={100} value={form.nama} onChange={(event) => setForm((current) => ({ ...current, nama: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></div><div className="flex gap-2"><button type="button" onClick={() => setModalMode(null)} className="flex-1 rounded-lg border py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Batal</button><button disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Simpan</button></div></form></div></div>}
    </main>
  );
};

export default OrganizationMaster;
