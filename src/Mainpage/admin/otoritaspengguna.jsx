import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRightCircle,
  CheckCircle2,
  Loader2,
  Search,
  Shield,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import API from "../../utils/axiosInstance";

const Otoritaspengguna = ({ onClose }) => {
  const [groups, setGroups] = useState([]);
  const [menus, setMenus] = useState([]);
  const [accessMenus, setAccessMenus] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(false);
  const [savingMenuId, setSavingMenuId] = useState(null);
  const [error, setError] = useState(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.grup_id === selectedGroupId),
    [groups, selectedGroupId]
  );

  const accessMenuIds = useMemo(
    () => new Set(accessMenus.map((menu) => menu.menu_id)),
    [accessMenus]
  );

  const groupedAvailableMenus = useMemo(() => {
    const filtered = menus.filter((menu) => {
      const keyword = searchTerm.trim().toLowerCase();
      if (accessMenuIds.has(menu.menu_id)) return false;
      if (!keyword) return true;
      return `${menu.menu_id} ${menu.nama} ${menu.parent_nama || ""}`.toLowerCase().includes(keyword);
    });

    return filtered.reduce((acc, menu) => {
      const groupName = menu.parent_nama || menu.nama || "Menu Utama";
      if (!acc[groupName]) acc[groupName] = [];
      acc[groupName].push(menu);
      return acc;
    }, {});
  }, [accessMenuIds, menus, searchTerm]);

  const fetchAccess = useCallback(async (groupId) => {
    if (!groupId) {
      setAccessMenus([]);
      return;
    }

    setAccessLoading(true);
    try {
      const response = await API.get("/hak_akses", {
        params: { grup_id: groupId },
      });
      setAccessMenus(response.data.data || []);
      setError(null);
    } catch (err) {
      console.error("Gagal memuat hak akses:", err);
      setError("Gagal memuat hak akses grup.");
    } finally {
      setAccessLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [groupResponse, menuResponse] = await Promise.all([
          API.get("/grup"),
          API.get("/menu"),
        ]);

        if (ignore) return;

        const groupData = groupResponse.data.data || [];
        const menuData = menuResponse.data.data || [];
        setGroups(groupData);
        setMenus(menuData);
        setSelectedGroupId((current) => current || groupData[0]?.grup_id || "");
        setError(menuData.length ? null : "Data menu belum tersedia di database.");
      } catch (err) {
        console.error("Gagal memuat otoritas menu:", err);
        if (!ignore) setError("Gagal memuat data otoritas dari server.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchInitialData();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    fetchAccess(selectedGroupId);
  }, [fetchAccess, selectedGroupId]);

  const handleClose = () => {
    if (onClose) onClose("settings");
  };

  const handleGrantAccess = async (menu) => {
    if (!selectedGroupId) {
      Swal.fire("Peringatan", "Pilih grup terlebih dahulu.", "warning");
      return;
    }

    setSavingMenuId(menu.menu_id);
    try {
      const response = await API.post("/hak_akses", {
        grup_id: selectedGroupId,
        menu_item_id: menu.menu_id,
      });

      if (response.data.status === 1) {
        await fetchAccess(selectedGroupId);
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal menambah hak akses.", "warning");
      }
    } catch (err) {
      console.error("Gagal menambah hak akses:", err);
      Swal.fire("Error", "Gagal menghubungi server.", "error");
    } finally {
      setSavingMenuId(null);
    }
  };

  const handleGrantAll = async () => {
    if (!selectedGroupId) {
      Swal.fire("Peringatan", "Pilih grup terlebih dahulu.", "warning");
      return;
    }

    setSavingMenuId("__all__");
    try {
      for (const menu of availableMenus) {
        await API.post("/hak_akses", {
          grup_id: selectedGroupId,
          menu_item_id: menu.menu_id,
        });
      }
      await fetchAccess(selectedGroupId);
      Swal.fire({ icon: "success", title: "Berhasil", text: "Semua menu tersedia sudah diberikan.", timer: 1500, showConfirmButton: false });
    } catch (err) {
      console.error("Gagal menambah semua hak akses:", err);
      Swal.fire("Error", "Gagal menambah semua hak akses.", "error");
    } finally {
      setSavingMenuId(null);
    }
  };

  const handleRevokeAccess = async (menu) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Hapus akses menu?",
      text: `${selectedGroup?.nama || selectedGroupId} tidak akan bisa mengakses ${menu.nama}.`,
      showCancelButton: true,
      confirmButtonText: "Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    setSavingMenuId(menu.menu_id);
    try {
      const response = await API.delete("/hak_akses", {
        params: {
          grup_id: selectedGroupId,
          menu_item_id: menu.menu_id,
        },
      });

      if (response.data.status === 1) {
        await fetchAccess(selectedGroupId);
      } else {
        Swal.fire("Peringatan", response.data.message || "Gagal menghapus hak akses.", "warning");
      }
    } catch (err) {
      console.error("Gagal menghapus hak akses:", err);
      Swal.fire("Error", "Gagal menghubungi server.", "error");
    } finally {
      setSavingMenuId(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!selectedGroupId || !accessMenus.length) return;
    const result = await Swal.fire({
      icon: "warning",
      title: "Hapus semua akses grup?",
      text: `${selectedGroup?.nama || selectedGroupId} tidak akan memiliki menu aktif.`,
      showCancelButton: true,
      confirmButtonText: "Hapus Semua",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;

    setSavingMenuId("__all__");
    try {
      for (const menu of accessMenus) {
        await API.delete("/hak_akses", {
          params: { grup_id: selectedGroupId, menu_item_id: menu.menu_id },
        });
      }
      await fetchAccess(selectedGroupId);
      Swal.fire({ icon: "success", title: "Berhasil", text: "Semua akses grup sudah dihapus.", timer: 1500, showConfirmButton: false });
    } catch (err) {
      console.error("Gagal menghapus semua hak akses:", err);
      Swal.fire("Error", "Gagal menghapus semua hak akses.", "error");
    } finally {
      setSavingMenuId(null);
    }
  };

  const renderMenuRows = (items, actionType) => {
    if (!items.length) {
      return (
        <tr>
          <td colSpan="4" className="px-4 py-10 text-center text-sm text-slate-400">
            Tidak ada data menu.
          </td>
        </tr>
      );
    }

    return items.map((menu) => (
      <tr key={menu.menu_id} className="border-b border-slate-100 transition hover:bg-blue-50/40">
        <td className="whitespace-nowrap px-4 py-3">
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
            {menu.menu_id}
          </span>
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">{menu.nama}</p>
          <p className="mt-1 text-xs text-slate-400">{menu.path || "-"}</p>
        </td>
        <td className="hidden px-4 py-3 text-sm text-slate-500 lg:table-cell">
          {menu.parent_nama || "Menu Utama"}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right">
          {actionType === "grant" ? (
            <button
              type="button"
              onClick={() => handleGrantAccess(menu)}
              disabled={savingMenuId === menu.menu_id || !selectedGroupId}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Tambah akses"
            >
              {savingMenuId === menu.menu_id ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightCircle size={16} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleRevokeAccess(menu)}
              disabled={savingMenuId === menu.menu_id || !selectedGroupId}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Hapus akses"
            >
              {savingMenuId === menu.menu_id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}
        </td>
      </tr>
    ));
  };

  const flattenGroups = (groupedMenus) => Object.values(groupedMenus).flat();
  const availableMenus = flattenGroups(groupedAvailableMenus);
  const syncedMenus = menus.filter((menu) => menu.path);

  return (
    <main className="min-h-[calc(100vh-4rem)] rounded-2xl border border-white/80 bg-white/82 px-4 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
              <Shield size={16} />
              Access Control
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Otoritas Menu</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Atur menu yang dapat diakses oleh setiap grup pengguna berdasarkan data menu dan hak akses di database.
            </p>
          </div>

          <button
            onClick={handleClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            aria-label="Tutup otoritas menu"
          >
            <X size={19} />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Grup</p>
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
                <p className="text-sm text-slate-500">Menu Aktif</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{syncedMenus.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Shield size={21} />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Akses Grup Ini</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{accessMenus.length}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <CheckCircle2 size={21} />
              </div>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Hak Akses Menu</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedGroup ? `${selectedGroup.grup_id} - ${selectedGroup.nama}` : "Pilih grup untuk mengatur otoritas menu."}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  value={selectedGroupId}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Pilih grup</option>
                  {groups.map((group) => (
                    <option key={group.grup_id} value={group.grup_id}>
                      {group.grup_id} - {group.nama}
                    </option>
                  ))}
                </select>

                <div className="relative w-full sm:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    type="text"
                    placeholder="Cari menu, ID, parent..."
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
              </div>
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:mx-5">
              <AlertCircle className="mt-0.5 shrink-0" size={18} />
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="px-5 py-16 text-center">
              <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" size={26} />
              <p className="text-sm font-semibold text-slate-700">Memuat data otoritas</p>
              <p className="mt-1 text-sm text-slate-400">Mohon tunggu sebentar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <h3 className="font-bold text-slate-950">Menu Tersedia</h3>
                    <p className="mt-1 text-sm text-slate-500">{availableMenus.length} menu belum diberikan ke grup ini.</p>
                  </div>
                  <button
                    onClick={handleGrantAll}
                    disabled={!availableMenus.length || savingMenuId === "__all__"}
                    className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingMenuId === "__all__" ? "Memproses..." : "Beri Semua"}
                  </button>
                </div>
                <div className="max-h-[580px] overflow-auto">
                  <table className="min-w-full">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Menu</th>
                        <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">Parent</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>{renderMenuRows(availableMenus, "grant")}</tbody>
                  </table>
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <h3 className="font-bold text-slate-950">Hak Akses</h3>
                    <p className="mt-1 text-sm text-slate-500">{accessMenus.length} menu aktif untuk grup terpilih.</p>
                  </div>
                  <button
                    onClick={handleRevokeAll}
                    disabled={!accessMenus.length || savingMenuId === "__all__"}
                    className="inline-flex h-9 items-center rounded-lg border border-red-200 px-3 text-xs font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Hapus Semua
                  </button>
                </div>
                <div className="max-h-[580px] overflow-auto">
                  {accessLoading ? (
                    <div className="px-5 py-16 text-center">
                      <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" size={24} />
                      <p className="text-sm font-semibold text-slate-700">Memuat hak akses</p>
                    </div>
                  ) : accessMenus.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <Shield size={24} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">Belum ada menu untuk grup ini</p>
                      <p className="mt-1 text-sm text-slate-400">Contoh kosong: Dashboard, Inventory, Report, Settings, dan menu lain belum diberikan.</p>
                    </div>
                  ) : (
                    <table className="min-w-full">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Menu</th>
                          <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">Parent</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>{renderMenuRows(accessMenus, "revoke")}</tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
};

export default Otoritaspengguna;
