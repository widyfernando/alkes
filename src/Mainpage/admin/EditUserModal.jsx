import React, { useEffect, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import Swal from "sweetalert2";
import API from "../../utils/axiosInstance";

const emptyForm = {
  username: "",
  dept_id: "",
  email: "",
  grup_id: "",
  jabatan_id: "",
  nama: "",
  password: "",
};

const EditUserModal = ({ isOpen, userId, onClose, onRefresh }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [departemenOptions, setDepartemenOptions] = useState([]);
  const [grupOptions, setGrupOptions] = useState([]);
  const [jabatanOptions, setJabatanOptions] = useState([]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    let ignore = false;

    const loadData = async () => {
      setLoading(true);
      try {
        const [detailResponse, departemenResponse, grupResponse, jabatanResponse] = await Promise.all([
          API.get("/detail_user", { params: { user_id: userId } }),
          API.get("/departemen"),
          API.get("/grup"),
          API.get("/jabatan"),
        ]);

        if (ignore) return;

        if (detailResponse.data.status !== 1) {
          Swal.fire("Peringatan", detailResponse.data.message || "Data user tidak ditemukan.", "warning");
          onClose();
          return;
        }

        const user = detailResponse.data.user || {};
        setFormData({
          username: user.username || "",
          dept_id: user.dept_id || "",
          email: user.email || "",
          grup_id: user.grup_id || "",
          jabatan_id: user.jabatan_id || "",
          nama: user.nama || "",
          password: "",
        });
        setDepartemenOptions(departemenResponse.data.data || []);
        setGrupOptions(grupResponse.data.data || []);
        setJabatanOptions(jabatanResponse.data.data || []);
      } catch (err) {
        console.error("Gagal memuat detail user:", err);
        if (!ignore) Swal.fire("Error", "Gagal memuat data pengguna.", "error");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, [isOpen, onClose, userId]);

  if (!isOpen) return null;

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    const payload = { ...formData };
    if (!payload.password) delete payload.password;

    try {
      const response = await API.put("/user", payload, {
        params: { user_id: userId },
      });

      if (response.data.status === 1) {
        Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: response.data.message,
          timer: 1800,
          showConfirmButton: false,
        });
        onRefresh();
        onClose();
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal mengupdate user.", "warning");
      }
    } catch (err) {
      console.error("Error updating user:", err);
      Swal.fire("Error", "Gagal menghubungi server. Silakan coba lagi.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b bg-gray-50 px-6 py-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Edit Pengguna</h3>
            <p className="mt-1 font-mono text-xs text-gray-400">{userId}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 transition hover:text-red-500">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-6 text-sm text-gray-500">
            <Loader2 className="mb-3 animate-spin text-blue-600" size={26} />
            Memuat data pengguna
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Nama Lengkap</label>
              <input required name="nama" value={formData.nama} onChange={handleChange} className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Username</label>
                <input required name="username" value={formData.username} onChange={handleChange} className="w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Email</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Departemen</label>
                <select required name="dept_id" value={formData.dept_id} onChange={handleChange} className="w-full rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Pilih</option>
                  {departemenOptions.map((departemen) => (
                    <option key={departemen.departemen_id} value={departemen.departemen_id}>
                      {departemen.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Grup</label>
                <select required name="grup_id" value={formData.grup_id} onChange={handleChange} className="w-full rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Pilih</option>
                  {grupOptions.map((grup) => (
                    <option key={grup.grup_id} value={grup.grup_id}>
                      {grup.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Jabatan</label>
                <select required name="jabatan_id" value={formData.jabatan_id} onChange={handleChange} className="w-full rounded-lg border bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Pilih</option>
                  {jabatanOptions.map((jabatan) => (
                    <option key={jabatan.jabatan_id} value={jabatan.jabatan_id}>
                      {jabatan.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Password Baru</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500" placeholder="Kosongkan jika tidak diganti" autoComplete="new-password" />
            </div>

            <div className="flex gap-2 pt-4">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50">
                Batal
              </button>
              <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Simpan Perubahan
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditUserModal;
