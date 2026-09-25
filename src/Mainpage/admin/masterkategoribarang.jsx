import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Edit, FolderTree, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import Swal from "sweetalert2";
import API from "../../utils/axiosInstance";

const emptyForm = { kategori_id: "", nama: "", keterangan: "" };

const MasterKategoriBarang = ({ onClose }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalMode, setModalMode] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/kategori_barang", { params: { search: searchTerm } });
      setItems(response.data.data || []);
    } catch (error) {
      console.error("Gagal memuat kategori barang:", error);
      Swal.fire("Error", "Gagal memuat kategori barang.", "error");
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(fetchItems, 350);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  const filteredItems = useMemo(() => items, [items]);

  const openAdd = () => {
    setFormData(emptyForm);
    setModalMode("add");
  };

  const openEdit = async (item) => {
    setSaving(true);
    try {
      const response = await API.get("/detail_kategori_barang", { params: { kategori_id: item.kategori_id } });
      if (response.data.status === 1) {
        setFormData(response.data.kategori_barang || emptyForm);
        setModalMode("edit");
      } else {
        Swal.fire("Peringatan", response.data.message || "Data kategori tidak ditemukan.", "warning");
      }
    } catch (error) {
      console.error("Gagal memuat detail kategori:", error);
      Swal.fire("Error", "Gagal memuat detail kategori.", "error");
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { nama: formData.nama, keterangan: formData.keterangan };
      const response =
        modalMode === "edit"
          ? await API.put("/kategori_barang", payload, { params: { kategori_id: formData.kategori_id } })
          : await API.post("/kategori_barang", payload);

      if (response.data.status === 1) {
        Swal.fire({ icon: "success", title: "Berhasil", text: response.data.message, timer: 1600, showConfirmButton: false });
        setModalMode(null);
        setFormData(emptyForm);
        fetchItems();
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal menyimpan kategori.", "warning");
      }
    } catch (error) {
      console.error("Gagal menyimpan kategori:", error);
      Swal.fire("Error", error.response?.data?.message || "Gagal menghubungi server.", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Hapus kategori?",
      text: `${item.nama} akan dihapus dari master kategori barang.`,
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;

    try {
      const response = await API.delete("/kategori_barang", { params: { kategori_id: item.kategori_id } });
      if (response.data.status === 1) {
        Swal.fire({ icon: "success", title: "Berhasil", text: response.data.message, timer: 1500, showConfirmButton: false });
        fetchItems();
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal menghapus kategori.", "warning");
      }
    } catch (error) {
      console.error("Gagal menghapus kategori:", error);
      Swal.fire("Error", error.response?.data?.message || "Gagal menghubungi server.", "error");
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/82 px-4 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
              <FolderTree size={16} />
              Master Data
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Master Kategori Barang</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Kelola kategori untuk pengelompokan barang di master barang dan inventory.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={openAdd} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              <Plus size={17} />
              Tambah Kategori
            </button>
            <button onClick={() => onClose?.("master")} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-red-50 hover:text-red-600">
              <X size={19} />
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Daftar Kategori</h2>
              <p className="mt-1 text-sm text-slate-500">Total {items.length} kategori barang.</p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Cari kategori..." className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Kode</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Nama Kategori</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Keterangan</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="px-5 py-16 text-center">
                      <Loader2 className="mx-auto animate-spin text-blue-600" />
                    </td>
                  </tr>
                ) : filteredItems.length ? (
                  filteredItems.map((item) => (
                    <tr key={item.kategori_id} className="hover:bg-blue-50/40">
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{item.kategori_id}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-950">{item.nama}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{item.keterangan || "-"}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEdit(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50">
                            <Edit size={15} />
                          </button>
                          <button onClick={() => remove(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-5 py-16 text-center text-sm text-slate-500">Belum ada data kategori barang.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {modalMode && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{modalMode === "edit" ? "Edit Kategori" : "Tambah Kategori"}</h3>
                {formData.kategori_id && <p className="mt-1 font-mono text-xs text-gray-400">{formData.kategori_id}</p>}
              </div>
              <button type="button" onClick={() => setModalMode(null)} className="text-gray-400 hover:text-red-500">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4 p-6">
              <Field label="Nama Kategori" value={formData.nama} onChange={(value) => setFormData((current) => ({ ...current, nama: value }))} required />
              <Textarea label="Keterangan" value={formData.keterangan} onChange={(value) => setFormData((current) => ({ ...current, keterangan: value }))} />
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setModalMode(null)} className="flex-1 rounded-lg border border-gray-300 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">Batal</button>
                <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

const Field = ({ label, value, onChange, required = false }) => (
  <div>
    <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">{label}</label>
    <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
  </div>
);

const Textarea = ({ label, value, onChange }) => (
  <div>
    <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">{label}</label>
    <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
  </div>
);

export default MasterKategoriBarang;
