// src/Mainpage/admin/AddUserModal.jsx
import React, { useRef, useState } from "react";
import { X, Loader2, Save } from "lucide-react";
import API from "../../utils/axiosInstance";
import Swal from "sweetalert2";

const AddUserModal = ({ isOpen, onClose, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [loadingDepartemen, setLoadingDepartemen] = useState(false);
  const [loadingGrup, setLoadingGrup] = useState(false);
  const [loadingJabatan, setLoadingJabatan] = useState(false);
  const [departemenOptions, setDepartemenOptions] = useState([]);
  const [grupOptions, setGrupOptions] = useState([]);
  const [jabatanOptions, setJabatanOptions] = useState([]);
  const requestedDepartemenRef = useRef(false);
  const requestedGrupRef = useRef(false);
  const requestedJabatanRef = useRef(false);
  const [formData, setFormData] = useState({
    username: "",
    dept_id: "",
    email: "",
    grup_id: "",
    jabatan_id: "",
    nama: "",
  });

  const fetchDepartemen = async () => {
    if (requestedDepartemenRef.current || departemenOptions.length > 0) return;

    requestedDepartemenRef.current = true;
    setLoadingDepartemen(true);
    try {
      const response = await API.get("/departemen");
      setDepartemenOptions(response.data.data || []);
    } catch (err) {
      requestedDepartemenRef.current = false;
      console.error("Gagal mengambil data departemen:", err);
      Swal.fire("Error", "Gagal memuat data departemen.", "error");
    } finally {
      setLoadingDepartemen(false);
    }
  };

  const fetchGrup = async () => {
    if (requestedGrupRef.current || grupOptions.length > 0) return;

    requestedGrupRef.current = true;
    setLoadingGrup(true);
    try {
      const response = await API.get("/grup");
      setGrupOptions(response.data.data || []);
    } catch (err) {
      requestedGrupRef.current = false;
      console.error("Gagal mengambil data grup:", err);
      Swal.fire("Error", "Gagal memuat data grup.", "error");
    } finally {
      setLoadingGrup(false);
    }
  };

  const fetchJabatan = async () => {
    if (requestedJabatanRef.current || jabatanOptions.length > 0) return;

    requestedJabatanRef.current = true;
    setLoadingJabatan(true);
    try {
      const response = await API.get("/jabatan");
      setJabatanOptions(response.data.data || []);
    } catch (err) {
      requestedJabatanRef.current = false;
      console.error("Gagal mengambil data jabatan:", err);
      Swal.fire("Error", "Gagal memuat data jabatan.", "error");
    } finally {
      setLoadingJabatan(false);
    }
  };

  const openDepartemenDropdown = () => {
    fetchDepartemen();
  };

  const openGrupDropdown = () => {
    fetchGrup();
  };

  const openJabatanDropdown = () => {
    fetchJabatan();
  };

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await API.post("/user", formData);

      // Menangani response sesuai gambar (status: 1 adalah berhasil)
      if (response.data.status === 1) {
        Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: response.data.message,
          timer: 2000,
          showConfirmButton: false,
        });
        onRefresh(); // Refresh tabel utama
        onClose(); // Tutup modal
        setFormData({ username: "", dept_id: "", email: "", grup_id: "", jabatan_id: "", nama: "" });
      } else {
        // Status 2: Username atau Email sudah terdaftar
        Swal.fire("Peringatan", response.data.message, "warning");
      }
    } catch (err) {
      console.error("Error adding user:", err);
      Swal.fire("Error", "Gagal menghubungi server. Silakan coba lagi.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Tambah Pengguna Baru</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nama Lengkap</label>
              <input required name="nama" value={formData.nama} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs" placeholder="Contoh: Jeremy Edbert" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Username</label>
                <input required name="username" value={formData.username} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs font-mono" placeholder="it_jeremy" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Email</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs" placeholder="email@onpos.com" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Departemen</label>
                <select
                  required
                  name="dept_id"
                  value={formData.dept_id}
                  onChange={handleChange}
                  onFocus={openDepartemenDropdown}
                  onMouseDown={openDepartemenDropdown}
                  disabled={loadingDepartemen}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">{loadingDepartemen ? "Memuat..." : "Pilih"}</option>
                  {departemenOptions.map((departemen) => (
                    <option key={departemen.departemen_id} value={departemen.departemen_id}>
                      {departemen.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Grup</label>
                <select
                  required
                  name="grup_id"
                  value={formData.grup_id}
                  onChange={handleChange}
                  onFocus={openGrupDropdown}
                  onMouseDown={openGrupDropdown}
                  disabled={loadingGrup}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">{loadingGrup ? "Memuat..." : "Pilih"}</option>
                  {grupOptions.map((grup) => (
                    <option key={grup.grup_id} value={grup.grup_id}>
                      {grup.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Jabatan</label>
                <select
                  required
                  name="jabatan_id"
                  value={formData.jabatan_id}
                  onChange={handleChange}
                  onFocus={openJabatanDropdown}
                  onMouseDown={openJabatanDropdown}
                  disabled={loadingJabatan}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">{loadingJabatan ? "Memuat..." : "Pilih"}</option>
                  {jabatanOptions.map((jabatan) => (
                    <option key={jabatan.jabatan_id} value={jabatan.jabatan_id}>
                      {jabatan.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition">
              Batal
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Simpan Data
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
