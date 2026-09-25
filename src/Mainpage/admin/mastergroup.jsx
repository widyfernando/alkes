import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Edit,
  Loader2,
  Plus,
  Save,
  Search,
  Shield,
  UsersRound,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import API from "../../utils/axiosInstance";

const emptyForm = {
  grup_id: "",
  nama: "",
};

const Mastergroup = ({ onClose }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [modalMode, setModalMode] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await API.get("/grup");
      setGroups(response.data.data || []);
      setError(null);
    } catch (err) {
      console.error("Gagal mengambil data grup:", err);
      setError("Gagal memuat data grup dari server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const filteredGroups = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return groups;

    return groups.filter((group) =>
      `${group.grup_id} ${group.nama}`.toLowerCase().includes(keyword)
    );
  }, [groups, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const visibleGroups = filteredGroups.slice(startIndex, startIndex + perPage);
  const startData = filteredGroups.length === 0 ? 0 : startIndex + 1;
  const endData = Math.min(startIndex + perPage, filteredGroups.length);

  useEffect(() => {
    setPage(1);
  }, [perPage, searchTerm]);

  const handleClose = () => {
    if (onClose) onClose("settings");
  };

  const openAddModal = () => {
    setFormData(emptyForm);
    setModalMode("add");
  };

  const openEditModal = async (groupId) => {
    setSaving(true);
    try {
      const response = await API.get("/detail_grup", {
        params: { grup_id: groupId },
      });

      if (response.data.status === 1) {
        setFormData(response.data.grup || emptyForm);
        setModalMode("edit");
      } else {
        Swal.fire("Peringatan", response.data.message || "Data grup tidak ditemukan.", "warning");
      }
    } catch (err) {
      console.error("Gagal mengambil detail grup:", err);
      Swal.fire("Error", "Gagal memuat detail grup.", "error");
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    if (saving) return;
    setModalMode(null);
    setFormData(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response =
        modalMode === "edit"
          ? await API.put("/grup", { nama: formData.nama }, { params: { grup_id: formData.grup_id } })
          : await API.post("/grup", { nama: formData.nama });

      if (response.data.status === 1) {
        Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: response.data.message,
          timer: 1800,
          showConfirmButton: false,
        });
        closeModal();
        fetchGroups();
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal menyimpan data grup.", "warning");
      }
    } catch (err) {
      console.error("Gagal menyimpan grup:", err);
      Swal.fire("Error", "Gagal menghubungi server. Silakan coba lagi.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/82 px-4 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
              <Shield size={16} />
              User Group Master
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Master Group User</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Kelola daftar grup pengguna berdasarkan tabel grup di database.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openAddModal}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <Plus size={17} />
              Tambah Grup
            </button>
            <button
              onClick={handleClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label="Tutup master group"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Grup</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{groups.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <UsersRound size={21} />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Hasil Filter</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{filteredGroups.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Search size={21} />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Halaman</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {currentPage}
                  <span className="text-base font-semibold text-slate-400">/{totalPages}</span>
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Shield size={21} />
              </div>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Daftar Grup</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Menampilkan {startData}-{endData} dari {filteredGroups.length} data grup.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    type="text"
                    placeholder="Cari kode atau nama grup..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
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

                <select
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  value={perPage}
                  onChange={(event) => setPerPage(Number(event.target.value))}
                >
                  <option value="10">10 baris</option>
                  <option value="25">25 baris</option>
                  <option value="50">50 baris</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-5">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <p>{error}</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Kode</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nama Grup</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="3" className="px-5 py-16 text-center">
                      <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" size={26} />
                      <p className="text-sm font-semibold text-slate-700">Memuat data grup</p>
                      <p className="mt-1 text-sm text-slate-400">Mohon tunggu sebentar.</p>
                    </td>
                  </tr>
                ) : visibleGroups.length > 0 ? (
                  visibleGroups.map((group) => (
                    <tr key={group.grup_id} className="transition hover:bg-blue-50/40">
                      <td className="whitespace-nowrap px-5 py-4 text-sm">
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
                          {group.grup_id}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-950">{group.nama}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(group.grup_id)}
                            disabled={saving}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Edit grup"
                          >
                            <Edit size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="px-5 py-16 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <UsersRound size={24} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {searchTerm ? "Data tidak ditemukan" : "Belum ada data grup"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {searchTerm ? `"${searchTerm}" tidak cocok dengan data mana pun.` : "Tambahkan grup baru dari tombol Tambah Grup."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-slate-500">
              Total <span className="font-semibold text-slate-900">{filteredGroups.length}</span> grup
            </p>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                Prev
              </button>
              <span className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white">
                {currentPage}
              </span>
              <button
                disabled={currentPage >= totalPages || loading}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </section>

      {modalMode && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  {modalMode === "edit" ? "Edit Grup" : "Tambah Grup"}
                </h3>
                {formData.grup_id && <p className="mt-1 font-mono text-xs text-gray-400">{formData.grup_id}</p>}
              </div>
              <button type="button" onClick={closeModal} className="text-gray-400 transition hover:text-red-500">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Nama Grup</label>
                <input
                  required
                  name="nama"
                  value={formData.nama}
                  onChange={(event) => setFormData((current) => ({ ...current, nama: event.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contoh: MNG_IT"
                  maxLength={25}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 rounded-lg border border-gray-300 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50">
                  Batal
                </button>
                <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">
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

export default Mastergroup;
