import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Edit,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Save,
  Search,
  Shield,
  Trash2,
  UserCog,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import API from "../../utils/axiosInstance";
import AddUserModal from "./AddUserModal";
import EditUserModal from "./EditUserModal";
import Swal from "sweetalert2";
import { getStoredUser } from "../../utils/authStorage";

const getInitials = (name = "") => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "U";

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};

const Pengaturanpengguna = ({
  onClose,
  mode = "settings",
  title = "Pengaturan Pengguna",
  eyebrow = "User Settings",
  description = "Kelola profil dan keamanan akun yang sedang digunakan.",
}) => {
  const otoritasRef = useRef(null);
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalData, setTotalData] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [resettingUserId, setResettingUserId] = useState(null);
  const [accountDetail, setAccountDetail] = useState(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const totalPages = useMemo(() => {
    if (!totalData) return 1;
    return Math.max(1, Math.ceil(totalData / perPage));
  }, [perPage, totalData]);

  const startData = totalData === 0 ? 0 : (page - 1) * perPage + 1;
  const endData = Math.min(page * perPage, totalData);

  const fetchUsers = useCallback(async () => {
    if (mode !== "master") return;

    setLoading(true);

    try {
      const response = await API.get("/user", {
        params: {
          page,
          per_page: perPage,
          search: searchTerm,
        },
      });

      const userData = response.data.data || [];

      setUsers(userData);
      setTotalData(response.data.total || userData.length || 0);
      setError(null);
    } catch (err) {
      console.error("Gagal mengambil data user:", err);
      setError("Gagal memuat data pengguna. Periksa koneksi API lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [mode, page, perPage, searchTerm]);

  useEffect(() => {
    if (mode !== "master") return undefined;

    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchUsers, mode]);

  useEffect(() => {
    if (mode === "master") return undefined;

    let ignore = false;

    const fetchAccountDetail = async () => {
      const userId = storedUser.user_id;
      if (!userId) {
        setAccountDetail(null);
        setAccountLoading(false);
        return;
      }

      setAccountLoading(true);
      try {
        const response = await API.get("/detail_user", {
          params: { user_id: userId },
        });

        if (ignore) return;

        if (response.data.status === 1) {
          setAccountDetail(response.data.user);
          setError(null);
        } else {
          setError(response.data.message || "Data akun tidak ditemukan.");
        }
      } catch (err) {
        console.error("Gagal memuat pengaturan pengguna:", err);
        if (!ignore) setError("Gagal memuat data akun. Periksa koneksi API lalu coba lagi.");
      } finally {
        if (!ignore) setAccountLoading(false);
      }
    };

    fetchAccountDetail();

    return () => {
      ignore = true;
    };
  }, [mode, storedUser.user_id]);

  const handleClose = () => {
    if (onClose) onClose("settings");
  };

  const handleDeleteUser = async (user) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Hapus pengguna?",
      text: `${user.nama || user.user_id} akan dinonaktifkan dari daftar pengguna aktif.`,
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    setDeletingUserId(user.user_id);
    try {
      const response = await API.put(
        "/set_status_user",
        { status: false },
        { params: { user_id: user.user_id } }
      );

      if (response.data.status === 1) {
        Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: response.data.message,
          timer: 1800,
          showConfirmButton: false,
        });
        fetchUsers();
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal menghapus pengguna.", "warning");
      }
    } catch (err) {
      console.error("Gagal menghapus user:", err);
      Swal.fire("Error", "Gagal menghubungi server. Silakan coba lagi.", "error");
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleResetPassword = async (user) => {
    const result = await Swal.fire({
      title: "Reset Password",
      html: `
        <div class="space-y-3 text-left">
          <div>
            <label for="reset-password" class="mb-1 block text-xs font-bold uppercase text-slate-500">Password Baru</label>
            <input id="reset-password" type="password" class="swal2-input !m-0 !w-full" placeholder="Minimal 6 karakter" autocomplete="new-password">
          </div>
          <div>
            <label for="reset-password-confirm" class="mb-1 block text-xs font-bold uppercase text-slate-500">Konfirmasi Password</label>
            <input id="reset-password-confirm" type="password" class="swal2-input !m-0 !w-full" placeholder="Ulangi password baru" autocomplete="new-password">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Simpan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#2563eb",
      preConfirm: () => {
        const password = document.getElementById("reset-password")?.value?.trim() || "";
        const confirmPassword = document.getElementById("reset-password-confirm")?.value?.trim() || "";

        if (password.length < 6) {
          Swal.showValidationMessage("Password baru minimal 6 karakter.");
          return null;
        }

        if (password !== confirmPassword) {
          Swal.showValidationMessage("Konfirmasi password tidak sama.");
          return null;
        }

        return { password };
      },
    });

    if (!result.isConfirmed || !result.value) return;

    setResettingUserId(user.user_id);
    try {
      const response = await API.put(
        "/reset_password",
        { password: result.value.password },
        { params: { user_id: user.user_id } }
      );

      if (response.data.status === 1) {
        Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: `Password ${user.nama || user.username || user.user_id} berhasil direset.`,
          timer: 1800,
          showConfirmButton: false,
        });
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal reset password.", "warning");
      }
    } catch (err) {
      console.error("Gagal reset password:", err);
      Swal.fire("Error", "Gagal menghubungi server. Silakan coba lagi.", "error");
    } finally {
      setResettingUserId(null);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (!storedUser.user_id) {
      Swal.fire("Peringatan", "User aktif tidak ditemukan. Silakan login ulang.", "warning");
      return;
    }

    if (passwordForm.password.length < 6) {
      Swal.fire("Peringatan", "Password baru minimal 6 karakter.", "warning");
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      Swal.fire("Peringatan", "Konfirmasi password tidak sama.", "warning");
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await API.put(
        "/reset_password",
        { password: passwordForm.password },
        { params: { user_id: storedUser.user_id } }
      );

      if (response.data.status === 1) {
        Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: "Password akun berhasil diperbarui.",
          timer: 1800,
          showConfirmButton: false,
        });
        setPasswordForm({ password: "", confirmPassword: "" });
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal memperbarui password.", "warning");
      }
    } catch (err) {
      console.error("Gagal memperbarui password:", err);
      Swal.fire("Error", "Gagal menghubungi server. Silakan coba lagi.", "error");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (mode !== "master") {
    const profile = accountDetail || storedUser;

    return (
      <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/82 px-4 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:px-6 lg:px-8">
        <section className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
                <UserCog size={16} />
                {eyebrow}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
            </div>

            <button
              onClick={handleClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label="Tutup pengaturan pengguna"
            >
              <X size={19} />
            </button>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <p>{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.9fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <UserRound size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Profil Akun</h2>
                  <p className="mt-1 text-sm text-slate-500">Informasi akun login saat ini.</p>
                </div>
              </div>

              {accountLoading ? (
                <div className="py-14 text-center">
                  <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" size={26} />
                  <p className="text-sm font-semibold text-slate-700">Memuat data akun</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-lg border border-slate-200 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">
                      {getInitials(profile.nama)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950">{profile.nama || "-"}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{profile.user_id || "-"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">Username</p>
                      <p className="mt-2 font-mono text-sm font-semibold text-slate-900">{profile.username || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">Email</p>
                      <p className="mt-2 truncate text-sm font-semibold text-slate-900">{profile.email || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">Grup</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{profile.grup || profile.grup_id || "-"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">Jabatan</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{profile.jabatan || profile.jabatan_id || "-"}</p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <KeyRound size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Keamanan Akun</h2>
                  <p className="mt-1 text-sm text-slate-500">Ubah password akun yang sedang login.</p>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Password Baru</label>
                  <input
                    type="password"
                    value={passwordForm.password}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Konfirmasi Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {passwordSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Simpan Password
                </button>
              </form>

              <div className="mt-5 flex gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                <Mail className="mt-0.5 shrink-0" size={17} />
                <p>Perubahan nama, email, grup, dan jabatan dikelola melalui menu Master Users oleh admin.</p>
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/82 px-4 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:px-6 lg:px-8">
      <section ref={otoritasRef} className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
              <Shield size={16} />
              {eyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <Plus size={17} />
              Tambah Pengguna
            </button>
            <button
              onClick={handleClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label="Tutup pengaturan pengguna"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Pengguna</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{totalData}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <UsersRound size={21} />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ditampilkan</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{users.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <UserRound size={21} />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Halaman</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {page}
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
                <h2 className="text-lg font-bold text-slate-950">Daftar Akun</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Menampilkan {startData}-{endData} dari {totalData} data pengguna.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    type="text"
                    placeholder="Cari nama, username, departemen..."
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setPage(1);
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setPage(1);
                      }}
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
                  onChange={(event) => {
                    setPerPage(Number(event.target.value));
                    setPage(1);
                  }}
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
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pengguna</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Username</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Departemen</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Jabatan</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-5 py-16 text-center">
                      <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" size={26} />
                      <p className="text-sm font-semibold text-slate-700">Memuat data pengguna</p>
                      <p className="mt-1 text-sm text-slate-400">Mohon tunggu sebentar.</p>
                    </td>
                  </tr>
                ) : users.length > 0 ? (
                  users.map((user, index) => (
                    <tr key={user.user_id || index} className="transition hover:bg-blue-50/40">
                      <td className="min-w-[260px] px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-700">
                            {getInitials(user.nama)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{user.nama || "-"}</p>
                            <p className="mt-1 text-xs text-slate-500 md:hidden">
                              {user.user_id || "-"} | {user.departemen || "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm">
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
                          {user.username || "-"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm">
                        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {user.departemen || "-"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {user.jabatan || "-"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingUserId(user.user_id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 text-blue-600 transition hover:bg-blue-50"
                            title="Edit pengguna"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetPassword(user)}
                            disabled={resettingUserId === user.user_id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-100 text-amber-600 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Reset password"
                          >
                            {resettingUserId === user.user_id ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={deletingUserId === user.user_id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Hapus pengguna"
                          >
                            {deletingUserId === user.user_id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-5 py-16 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <UsersRound size={24} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        {searchTerm ? "Data tidak ditemukan" : "Belum ada data pengguna"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {searchTerm ? `"${searchTerm}" tidak cocok dengan data mana pun.` : "Tambahkan pengguna baru untuk mulai mengelola akses."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm text-slate-500">
              Total <span className="font-semibold text-slate-900">{totalData}</span> pengguna
            </p>

            <div className="flex items-center gap-2">
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                Prev
              </button>
              <span className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white">
                {page}
              </span>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </section>

      <AddUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRefresh={fetchUsers}
      />
      <EditUserModal
        isOpen={Boolean(editingUserId)}
        userId={editingUserId}
        onClose={() => setEditingUserId(null)}
        onRefresh={fetchUsers}
      />
    </main>
  );
};

export default Pengaturanpengguna;
